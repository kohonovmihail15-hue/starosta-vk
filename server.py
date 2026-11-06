#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Староста.ВК — Единый Python-сервер, база данных SQLite и Бот ВКонтакте.
Работает на стандартной библиотеке Python 3 (не требует pip install).
Запуск:
    python server.py
"""

import json
import os
import random
import re
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ============================================================================
# 🔑 ГЛАВНЫЕ НАСТРОЙКИ СЕРВЕРА И БОТА ВК
# ============================================================================
VK_BOT_TOKEN = os.environ.get("VK_BOT_TOKEN", "ВСТАВЬТЕ_СЮДА_ТОКЕН_СООБЩЕСТВА_ВК")
VK_MINI_APP_ID = int(os.environ.get("VK_MINI_APP_ID", "54871400"))
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Автоматическое удаление старого файла базы starosta.db, если он остался от прошлых запусков
OLD_DB_PATH = os.path.join(BASE_DIR, "starosta.db")
if os.path.exists(OLD_DB_PATH):
    try:
        os.remove(OLD_DB_PATH)
    except OSError:
        pass

DB_PATH = os.environ.get(
    "STAROSTA_DB_PATH",
    os.path.join(BASE_DIR, "starosta_clean_v5.db"),
)

db_lock = threading.RLock()

EMPTY_DAILY_DEPUTY = {
    "mon": None,
    "tue": None,
    "wed": None,
    "thu": None,
    "fri": None,
    "sat": None,
}

EMPTY_DAILY_REASON = {
    "mon": "both_absent",
    "tue": "both_absent",
    "wed": "both_absent",
    "thu": "both_absent",
    "fri": "both_absent",
    "sat": "both_absent",
}

DEFAULT_DAILY_PERMS = {
    "canManageHomework": True,
    "canMarkAttendance": True,
    "canManageQueues": True,
}

EMPTY_DELETED_IDS = {
    "members": {},
    "schedule": {},
    "homeworks": {},
    "queues": {},
    "funds": {},
}


def normalize_code(raw: str) -> str:
    if not raw:
        return ""
    s = str(raw).strip().upper()
    s = re.sub(r"[—–−]", "-", s)
    s = re.sub(r"\s+", "", s)
    return s


def normalize_group_name(raw: str) -> str:
    if not raw:
        return ""
    return re.sub(r"[^A-ZА-ЯЁ0-9]", "", str(raw).strip().upper())


def extract_code_from_input(raw_input: str) -> str:
    text = str(raw_input or "").strip()
    if "join=" in text:
        part = text.split("join=", 1)[1].split("&")[0].split("#")[0].strip()
        return normalize_code(urllib.parse.unquote(part))
    match = re.search(r"VK-[A-ZА-ЯЁ0-9]+-\d{4}", text, flags=re.IGNORECASE)
    if match:
        return normalize_code(match.group(0))
    return normalize_code(text)


# ============================================================================
# 🗄️ ИНИЦИАЛИЗАЦИЯ И РАБОТА С БАЗОЙ ДАННЫХ SQLITE (starosta.db)
# ============================================================================
def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=15.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_db() -> None:
    with db_lock:
        conn = get_db_connection()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS groups (
                    code TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    name_norm TEXT NOT NULL,
                    university TEXT NOT NULL,
                    faculty TEXT NOT NULL,
                    course TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    updated_at INTEGER NOT NULL,
                    deleted INTEGER NOT NULL DEFAULT 0
                );

                CREATE INDEX IF NOT EXISTS idx_groups_name_norm
                ON groups(name_norm);

                CREATE TABLE IF NOT EXISTS student_bindings (
                    student_key TEXT PRIMARY KEY,
                    group_code TEXT NOT NULL,
                    member_id TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                """
            )
            conn.commit()
        finally:
            conn.close()


def merge_group_payloads(base_raw: dict, incoming_raw: dict) -> dict:
    """Атомарное слияние состояния группы в Python (без потери участников, расписания и ДЗ)."""
    if not base_raw or not base_raw.get("groupInfo"):
        return incoming_raw
    if not incoming_raw or not incoming_raw.get("groupInfo"):
        return base_raw

    base_ts = int(base_raw.get("updatedAt") or 0)
    inc_ts = int(incoming_raw.get("updatedAt") or 0)
    newer = incoming_raw if inc_ts >= base_ts else base_raw
    older = base_raw if inc_ts >= base_ts else incoming_raw

    older_del = older.get("deletedIds") or {}
    newer_del = newer.get("deletedIds") or {}
    deleted_ids = {
        k: {**(older_del.get(k) or {}), **(newer_del.get(k) or {})}
        for k in ("members", "schedule", "homeworks", "queues", "funds")
    }

    # 1. Слияние участников (members)
    member_map = {}

    def ingest_member(m: dict) -> None:
        if not isinstance(m, dict) or not m.get("id"):
            return
        m_id = str(m["id"])
        del_ts = deleted_ids["members"].get(m_id)
        joined_at = int(m.get("joinedAt") or 0)
        if del_ts and (not joined_at or joined_at <= int(del_ts)):
            return

        match_key = m_id
        m_vk = str(m.get("vkId") or "").strip()
        for k, ex in member_map.items():
            if k == m_id:
                match_key = k
                break
            ex_vk = str(ex.get("vkId") or "").strip()
            if m_vk and ex_vk and m_vk == ex_vk:
                match_key = k
                break
            if m.get("role") == "starosta" and ex.get("role") == "starosta":
                match_key = k
                break

        prev = member_map.get(match_key)
        if not prev:
            member_map[match_key] = {**m, "id": match_key}
        else:
            placeholders = {"Староста группы", "Староста", "Пользователь", ""}
            prev_placeholder = str(prev.get("name") or "").strip() in placeholders
            cur_placeholder = str(m.get("name") or "").strip() in placeholders

            prev_m_ts = int(prev.get("updatedAt") or base_ts)
            cur_m_ts = int(m.get("updatedAt") or inc_ts)
            pick_cur = (prev_placeholder and not cur_placeholder) or (
                not cur_placeholder and cur_m_ts >= prev_m_ts
            )

            chosen = (
                {**prev, **m, "id": match_key}
                if pick_cur
                else {**m, **prev, "id": match_key}
            )
            chosen["vkId"] = m_vk or str(prev.get("vkId") or "")
            m_tag = str(m.get("vkTag") or "").strip()
            prev_tag = str(prev.get("vkTag") or "").strip()
            if m_tag and m_tag not in ("@starosta", "@vk_student"):
                chosen["vkTag"] = m_tag
            else:
                chosen["vkTag"] = prev_tag or m_tag
            member_map[match_key] = chosen

    for item in older.get("members") or []:
        ingest_member(item)
    for item in newer.get("members") or []:
        ingest_member(item)
    merged_members = list(member_map.values())

    # 2. Слияние списков по ID
    def merge_list_by_id(list_old, list_new, del_map, custom_fn=None):
        res_map = {}
        for it in list_old or []:
            if isinstance(it, dict) and it.get("id") and it["id"] not in del_map:
                res_map[it["id"]] = it
        for it in list_new or []:
            if not isinstance(it, dict) or not it.get("id") or it["id"] in del_map:
                continue
            iid = it["id"]
            if iid not in res_map:
                res_map[iid] = it
            elif custom_fn:
                res_map[iid] = custom_fn(res_map[iid], it)
            else:
                res_map[iid] = {**res_map[iid], **it}
        return list(res_map.values())

    merged_schedule = merge_list_by_id(
        older.get("schedule"), newer.get("schedule"), deleted_ids["schedule"]
    )
    merged_homeworks = merge_list_by_id(
        older.get("homeworks"),
        newer.get("homeworks"),
        deleted_ids["homeworks"],
        lambda a, b: {
            **a,
            **b,
            "completedBy": list(
                dict.fromkeys((a.get("completedBy") or []) + (b.get("completedBy") or []))
            ),
        },
    )

    def merge_queue(a: dict, b: dict) -> dict:
        entries_map = {}
        for e in (a.get("entries") or []) + (b.get("entries") or []):
            if isinstance(e, dict) and e.get("userId"):
                entries_map[e["userId"]] = e
        return {**a, **b, "entries": list(entries_map.values())}

    merged_queues = merge_list_by_id(
        older.get("queues"), newer.get("queues"), deleted_ids["queues"], merge_queue
    )
    merged_funds = merge_list_by_id(
        older.get("funds"),
        newer.get("funds"),
        deleted_ids["funds"],
        lambda a, b: {
            **a,
            **b,
            "paidIds": list(
                dict.fromkeys((a.get("paidIds") or []) + (b.get("paidIds") or []))
            ),
        },
    )
    merged_broadcasts = merge_list_by_id(
        older.get("botBroadcasts"), newer.get("botBroadcasts"), {}
    )

    old_del_conf = older.get("deleteConfirmations") or {}
    new_del_conf = newer.get("deleteConfirmations") or {}
    st_old_ts = int(old_del_conf.get("starostaTs") or 0)
    st_new_ts = int(new_del_conf.get("starostaTs") or 0)
    dp_old_ts = int(old_del_conf.get("deputyTs") or 0)
    dp_new_ts = int(new_del_conf.get("deputyTs") or 0)

    merged_delete_confirmations = {
        "starosta": bool(
            new_del_conf.get("starosta")
            if st_new_ts >= st_old_ts
            else old_del_conf.get("starosta")
        ),
        "deputy": bool(
            new_del_conf.get("deputy")
            if dp_new_ts >= dp_old_ts
            else old_del_conf.get("deputy")
        ),
        "starostaTs": max(st_old_ts, st_new_ts),
        "deputyTs": max(dp_old_ts, dp_new_ts),
    }

    now_ms = int(time.time() * 1000)
    return {
        **older,
        **newer,
        "groupInfo": {**(older.get("groupInfo") or {}), **(newer.get("groupInfo") or {})},
        "members": merged_members,
        "schedule": merged_schedule,
        "homeworks": merged_homeworks,
        "queues": merged_queues,
        "funds": merged_funds,
        "botBroadcasts": merged_broadcasts,
        "attendance": {**(older.get("attendance") or {}), **(newer.get("attendance") or {})},
        "dailyDeputyByDay": {
            **EMPTY_DAILY_DEPUTY,
            **(older.get("dailyDeputyByDay") or {}),
            **(newer.get("dailyDeputyByDay") or {}),
        },
        "dailyAbsenceReasonByDay": {
            **EMPTY_DAILY_REASON,
            **(older.get("dailyAbsenceReasonByDay") or {}),
            **(newer.get("dailyAbsenceReasonByDay") or {}),
        },
        "dailyDeputyPermissions": {
            **DEFAULT_DAILY_PERMS,
            **(older.get("dailyDeputyPermissions") or {}),
            **(newer.get("dailyDeputyPermissions") or {}),
        },
        "deleteConfirmations": merged_delete_confirmations,
        "deletedIds": deleted_ids,
        "weekAnchor": newer.get("weekAnchor") or older.get("weekAnchor"),
        "updatedAt": max(base_ts, inc_ts, now_ms),
    }


def db_find_group(conn: sqlite3.Connection, raw_query: str):
    """Ищет группу в SQLite по коду (VK-...), 4 цифрам кода или названию группы."""
    code = extract_code_from_input(raw_query)
    name_norm = normalize_group_name(raw_query)
    if not code and not name_norm:
        return None

    # 1. Точное совпадение по коду
    row = conn.execute(
        "SELECT * FROM groups WHERE code = ? LIMIT 1", (code,)
    ).fetchone()
    if row:
        return row

    # 2. Совпадение по 4-значному окончанию кода (например, 4821)
    if re.fullmatch(r"\d{4}", code):
        row = conn.execute(
            "SELECT * FROM groups WHERE code LIKE ? AND deleted = 0 ORDER BY updated_at DESC LIMIT 1",
            (f"%-{code}",),
        ).fetchone()
        if row:
            return row

    # 3. Совпадение по нормализованному названию группы (например, ИСП-21 -> ИСП21)
    if name_norm:
        row = conn.execute(
            "SELECT * FROM groups WHERE name_norm = ? AND deleted = 0 ORDER BY updated_at DESC LIMIT 1",
            (name_norm,),
        ).fetchone()
        if row:
            return row

    return None


def db_save_group(conn: sqlite3.Connection, payload: dict) -> dict:
    """Сохраняет состояние группы и привязки участников в SQLite."""
    grp_info = payload.get("groupInfo") or {}
    code = normalize_code(grp_info.get("code"))
    name = str(grp_info.get("name") or code).strip()
    name_norm = normalize_group_name(name)
    university = str(grp_info.get("university") or "ВУЗ").strip()
    faculty = str(grp_info.get("faculty") or "Факультет не указан").strip()
    course = str(grp_info.get("course") or "1 курс").strip()
    now_ms = int(time.time() * 1000)
    payload["updatedAt"] = now_ms
    payload["groupInfo"]["code"] = code

    conn.execute(
        """
        INSERT INTO groups (code, name, name_norm, university, faculty, course, payload_json, updated_at, deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(code) DO UPDATE SET
            name = excluded.name,
            name_norm = excluded.name_norm,
            university = excluded.university,
            faculty = excluded.faculty,
            course = excluded.course,
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at,
            deleted = 0
        """,
        (
            code,
            name,
            name_norm,
            university,
            faculty,
            course,
            json.dumps(payload, ensure_ascii=False),
            now_ms,
        ),
    )

    # Обновляем привязки участников к этой группе (и очищаем удалённых)
    deleted_members = (payload.get("deletedIds") or {}).get("members") or {}
    for del_mem_id in deleted_members.keys():
        conn.execute(
            "DELETE FROM student_bindings WHERE group_code = ? AND member_id = ?",
            (code, str(del_mem_id)),
        )

    for m in payload.get("members") or []:
        if not isinstance(m, dict):
            continue
        m_id = str(m.get("id") or "")
        m_name = str(m.get("name") or "").strip().lower()
        m_vk = str(m.get("vkId") or "").strip()
        m_tag = str(m.get("vkTag") or "").strip().lower()
        keys = []
        if m_vk:
            keys.append(f"vk:{m_vk}")
        if m_tag and m_tag not in ("@starosta", "@vk_student", "@deputy"):
            keys.append(f"tag:{m_tag}")
        if m_name and m_name not in ("староста группы", "староста", "пользователь"):
            keys.append(f"name:{m_name}")
        for k in keys:
            conn.execute(
                """
                INSERT INTO student_bindings (student_key, group_code, member_id, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(student_key) DO UPDATE SET
                    group_code = excluded.group_code,
                    member_id = excluded.member_id,
                    updated_at = excluded.updated_at
                """,
                (k, code, m_id, now_ms),
            )

    return payload


# ============================================================================
# 🤖 ВЫЗОВ VK API ИЗ PYTHON (ДЛЯ БОТА И РАССЫЛОК)
# ============================================================================
def call_vk_api(method: str, params: dict = None) -> dict:
    params = dict(params or {})
    token = (params.pop("access_token", None) or VK_BOT_TOKEN or "").strip()
    if not token or token == "ВСТАВЬТЕ_СЮДА_ТОКЕН_СООБЩЕСТВА_ВК":
        return {"error": {"error_msg": "Токен бота ВК не задан в server.py или index.html"}}

    params["access_token"] = token
    params["v"] = params.get("v", "5.199")
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.vk.com/method/{method}",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        return {"error": {"error_msg": str(exc)}}


# ============================================================================
# 🌐 HTTP API СЕРВЕР (ОБСЛУЖИВАЕТ И index.html, И API ЗАПРОСЫ)
# ============================================================================
class StarostaRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[Староста.Python] {self.address_string()} - {fmt % args}")

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send_json(self, data: dict, status: int = 200):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(raw)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        # 1. Проверка статуса Python-сервера
        if path == "/api/health":
            with db_lock:
                conn = get_db_connection()
                try:
                    cnt = conn.execute(
                        "SELECT COUNT(*) AS c FROM groups WHERE deleted = 0"
                    ).fetchone()["c"]
                finally:
                    conn.close()
            self._send_json(
                {
                    "ok": True,
                    "engine": "Python SQLite Server",
                    "groupsCount": cnt,
                    "appId": VK_MINI_APP_ID,
                }
            )
            return

        # 2. Список всех активных групп в базе SQLite
        if path == "/api/groups":
            with db_lock:
                conn = get_db_connection()
                try:
                    rows = conn.execute(
                        "SELECT code, name, university, faculty, course, payload_json, updated_at FROM groups WHERE deleted = 0 ORDER BY updated_at DESC"
                    ).fetchall()
                    groups_list = []
                    for r in rows:
                        try:
                            p = json.loads(r["payload_json"])
                            members_cnt = len(p.get("members") or [])
                        except Exception:
                            members_cnt = 1
                        groups_list.append(
                            {
                                "code": r["code"],
                                "name": r["name"],
                                "university": r["university"],
                                "faculty": r["faculty"],
                                "course": r["course"],
                                "membersCount": members_cnt,
                                "updatedAt": r["updated_at"],
                            }
                        )
                finally:
                    conn.close()
            self._send_json({"ok": True, "groups": groups_list})
            return

        # 3. Получение конкретной группы по коду или названию
        if path == "/api/group":
            raw_query = (qs.get("code") or qs.get("query") or [""])[0]
            with db_lock:
                conn = get_db_connection()
                try:
                    row = db_find_group(conn, raw_query)
                    if not row:
                        self._send_json({"ok": False, "notFound": True}, status=404)
                        return
                    if row["deleted"]:
                        self._send_json({"ok": True, "deleted": True, "code": row["code"]})
                        return
                    payload = json.loads(row["payload_json"])
                finally:
                    conn.close()
            self._send_json({"ok": True, "data": payload, "source": "python_sqlite"})
            return

        # 4. Раздача интерфейса index.html при открытии корня сайта
        if path in ("/", "/index.html"):
            index_file = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "index.html"
            )
            if os.path.exists(index_file):
                with open(index_file, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(content)
                return

        self._send_json({"ok": False, "error": "Not found"}, status=404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        # 1. Создание новой группы старостой
        if path == "/api/group/create":
            grp_name = str(body.get("groupName") or "").strip()
            university = str(body.get("university") or "ВУЗ").strip()
            faculty = str(body.get("faculty") or "Факультет не указан").strip()
            course = str(body.get("course") or "1 курс").strip()
            starosta_name = str(body.get("starostaName") or "").strip() or "Староста группы"
            starosta_vk_id = str(body.get("vkId") or "").strip()
            starosta_tag = str(body.get("starostaVkTag") or "").strip() or (
                f"@id{starosta_vk_id}" if starosta_vk_id else "@starosta"
            )
            week_anchor = body.get("weekAnchor")
            force_create = bool(body.get("forceCreate"))

            if not grp_name:
                self._send_json({"ok": False, "error": "Введите название группы"}, status=400)
                return

            with db_lock:
                conn = get_db_connection()
                try:
                    if not force_create:
                        existing = conn.execute(
                            "SELECT * FROM groups WHERE name_norm = ? AND deleted = 0 ORDER BY updated_at DESC LIMIT 1",
                            (normalize_group_name(grp_name),),
                        ).fetchone()
                        if existing:
                            self._send_json(
                                {
                                    "ok": False,
                                    "conflict": True,
                                    "existingGroup": json.loads(existing["payload_json"]),
                                }
                            )
                            return

                    slug = re.sub(r"[^A-ZА-ЯЁ0-9]", "", grp_name.upper())[:6] or "GRP"
                    code = f"VK-{slug}-{random.randint(1000, 9999)}"
                    while conn.execute("SELECT 1 FROM groups WHERE code = ?", (code,)).fetchone():
                        code = f"VK-{slug}-{random.randint(1000, 9999)}"

                    now_ms = int(time.time() * 1000)
                    payload = {
                        "groupInfo": {
                            "name": grp_name,
                            "university": university,
                            "faculty": faculty,
                            "course": course,
                            "code": code,
                            "inviteLink": f"https://vk.com/app{VK_MINI_APP_ID}#join={code}",
                        },
                        "members": [
                            {
                                "id": "u1",
                                "vkId": starosta_vk_id,
                                "groupCode": code,
                                "name": starosta_name,
                                "vkTag": starosta_tag,
                                "subgroup": 1,
                                "role": "starosta",
                                "avatarColor": "bg-blue-600",
                                "joinedAt": now_ms,
                                "updatedAt": now_ms,
                                "permissions": {
                                    "canManageHomework": True,
                                    "canMarkAttendance": True,
                                    "canEditSchedule": True,
                                    "canManageQueues": True,
                                    "canPostAnnouncements": True,
                                },
                            }
                        ],
                        "schedule": [],
                        "homeworks": [],
                        "queues": [],
                        "funds": [],
                        "botBroadcasts": [],
                        "dailyDeputyByDay": dict(EMPTY_DAILY_DEPUTY),
                        "dailyAbsenceReasonByDay": dict(EMPTY_DAILY_REASON),
                        "dailyDeputyPermissions": dict(DEFAULT_DAILY_PERMS),
                        "attendance": {},
                        "deleteConfirmations": {"starosta": False, "deputy": False},
                        "deletedIds": dict(EMPTY_DELETED_IDS),
                        "weekAnchor": week_anchor,
                        "updatedAt": now_ms,
                    }
                    saved = db_save_group(conn, payload)
                    conn.commit()
                finally:
                    conn.close()

            self._send_json({"ok": True, "data": saved, "userId": "u1"})
            return

        # 2. Атомарный вход студента в существующую группу по коду или названию
        if path == "/api/group/join":
            raw_code = str(body.get("code") or "").strip()
            student_name = str(body.get("studentName") or "").strip()
            subgroup = int(body.get("subgroup") or 1)
            vk_id = str(body.get("vkId") or "").strip()
            vk_tag = str(body.get("vkTag") or "").strip() or (
                f"@id{vk_id}" if vk_id else "@vk_student"
            )

            if not raw_code or not student_name:
                self._send_json(
                    {"ok": False, "error": "Укажите код группы и ваше Имя и Фамилию."},
                    status=400,
                )
                return

            with db_lock:
                conn = get_db_connection()
                try:
                    row = db_find_group(conn, raw_code)
                    if not row or row["deleted"]:
                        self._send_json(
                            {
                                "ok": False,
                                "notFound": True,
                                "error": f"Группа «{raw_code}» не найдена в базе данных Python.",
                            },
                            status=404,
                        )
                        return

                    target_code = row["code"]
                    payload = json.loads(row["payload_json"])
                    norm_name = student_name.lower()

                    # Проверяем, не привязан ли студент уже к ДРУГОЙ активной группе
                    lookup_keys = [f"name:{norm_name}"]
                    if vk_id:
                        lookup_keys.insert(0, f"vk:{vk_id}")
                    if vk_tag and vk_tag.lower() not in ("@vk_student", "@starosta"):
                        lookup_keys.append(f"tag:{vk_tag.lower()}")

                    for lk in lookup_keys:
                        bound = conn.execute(
                            """
                            SELECT sb.group_code, g.name
                            FROM student_bindings sb
                            JOIN groups g ON g.code = sb.group_code
                            WHERE sb.student_key = ? AND g.deleted = 0
                            LIMIT 1
                            """,
                            (lk,),
                        ).fetchone()
                        if bound and bound["group_code"] != target_code:
                            self._send_json(
                                {
                                    "ok": False,
                                    "error": f"Вы уже состоите в группе «{bound['name']}» ({bound['group_code']}). Студент может состоять только в одной группе.",
                                },
                                status=409,
                            )
                            return

                    members = payload.get("members") or []
                    now_ms = int(time.time() * 1000)
                    existing_member = None
                    for m in members:
                        m_vk = str(m.get("vkId") or "").strip()
                        m_name = str(m.get("name") or "").strip().lower()
                        m_tag = str(m.get("vkTag") or "").strip().lower()
                        if (
                            (vk_id and m_vk and vk_id == m_vk)
                            or m_name == norm_name
                            or (
                                vk_tag.lower() not in ("@vk_student", "@starosta")
                                and m_tag == vk_tag.lower()
                            )
                        ):
                            existing_member = m
                            break

                    if existing_member:
                        active_id = existing_member["id"]
                        if existing_member.get("name") in ("Староста группы", "Староста"):
                            existing_member["name"] = student_name
                        existing_member["vkId"] = vk_id or existing_member.get("vkId") or ""
                        if vk_tag and vk_tag != "@vk_student":
                            existing_member["vkTag"] = vk_tag
                        existing_member["subgroup"] = subgroup or existing_member.get("subgroup") or 1
                        existing_member["groupCode"] = target_code
                        existing_member["joinedAt"] = now_ms
                        existing_member["updatedAt"] = now_ms
                    else:
                        active_id = f"u_{vk_id}" if vk_id else f"u_{now_ms}_{random.randint(10, 99)}"
                        new_student = {
                            "id": active_id,
                            "vkId": vk_id,
                            "groupCode": target_code,
                            "name": student_name,
                            "vkTag": vk_tag,
                            "subgroup": subgroup,
                            "role": "member",
                            "avatarColor": "bg-emerald-600",
                            "joinedAt": now_ms,
                            "updatedAt": now_ms,
                            "permissions": {
                                "canManageHomework": False,
                                "canMarkAttendance": False,
                                "canEditSchedule": False,
                                "canManageQueues": False,
                                "canPostAnnouncements": False,
                            },
                        }
                        members.append(new_student)

                    payload["members"] = members
                    del_members = (payload.get("deletedIds") or {}).get("members") or {}
                    del_members.pop(active_id, None)
                    if "deletedIds" not in payload:
                        payload["deletedIds"] = dict(EMPTY_DELETED_IDS)
                    payload["deletedIds"]["members"] = del_members

                    saved = db_save_group(conn, payload)
                    conn.commit()
                finally:
                    conn.close()

            self._send_json({"ok": True, "data": saved, "userId": active_id})
            return

        # 3. Атомарная синхронизация и сохранение изменений группы в SQLite
        if path == "/api/group/sync":
            raw_code = str(body.get("code") or body.get("payload", {}).get("groupInfo", {}).get("code") or "")
            incoming_payload = body.get("payload") or {}
            code = normalize_code(raw_code)
            if not code:
                self._send_json({"ok": False, "error": "Missing group code"}, status=400)
                return

            with db_lock:
                conn = get_db_connection()
                try:
                    if incoming_payload.get("deleted"):
                        conn.execute(
                            "UPDATE groups SET deleted = 1, updated_at = ? WHERE code = ?",
                            (int(time.time() * 1000), code),
                        )
                        conn.execute(
                            "DELETE FROM student_bindings WHERE group_code = ?", (code,)
                        )
                        conn.commit()
                        self._send_json({"ok": True, "deleted": True, "code": code})
                        return

                    row = conn.execute(
                        "SELECT * FROM groups WHERE code = ? LIMIT 1", (code,)
                    ).fetchone()
                    if row and row["deleted"]:
                        self._send_json({"ok": True, "deleted": True, "code": code})
                        return

                    if row:
                        db_payload = json.loads(row["payload_json"])
                        merged = merge_group_payloads(db_payload, incoming_payload)
                    else:
                        merged = incoming_payload

                    # Если староста и замстароста оба подтвердили удаление (2 из 2) — удаляем группу
                    del_conf = merged.get("deleteConfirmations") or {}
                    if del_conf.get("starosta") and del_conf.get("deputy"):
                        conn.execute(
                            "UPDATE groups SET deleted = 1, updated_at = ? WHERE code = ?",
                            (int(time.time() * 1000), code),
                        )
                        conn.execute(
                            "DELETE FROM student_bindings WHERE group_code = ?", (code,)
                        )
                        conn.commit()
                        self._send_json({"ok": True, "deleted": True, "code": code})
                        return

                    saved = db_save_group(conn, merged)
                    conn.commit()
                finally:
                    conn.close()

            self._send_json({"ok": True, "data": saved, "source": "python_sqlite"})
            return

        # 4. Прокси и рассылка важных сообщений через Бота ВК на стороне Python
        if path in ("/api/vk", "/api/broadcast"):
            method = str(body.get("method") or "messages.send")
            params = body.get("params") or {}
            res = call_vk_api(method, params)
            self._send_json(res)
            return

        self._send_json({"ok": False, "error": "Unknown endpoint"}, status=404)


def run_server():
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), StarostaRequestHandler)
    print("=" * 68)
    print(f"🐍 Староста.ВК — Python + SQLite сервер запущен!")
    print(f"📂 База данных SQLite: {DB_PATH}")
    print(f"🌐 Откройте в браузере: http://127.0.0.1:{PORT}")
    print(f"🔗 API адрес для приложения: http://127.0.0.1:{PORT}")
    print("=" * 68)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
        server.server_close()


if __name__ == "__main__":
    run_server()