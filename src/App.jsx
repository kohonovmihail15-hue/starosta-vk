import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  BookOpen,
  Users,
  Shield,
  Clock,
  Plus,
  Edit3,
  Trash2,
  UserCheck,
  Shuffle,
  Award,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  Sparkles,
  GraduationCap,
  Wallet,
  ListOrdered,
  Copy,
  Sun,
  Moon,
  Search,
  Link as LinkIcon,
  ArrowRight,
  Lock,
  Unlock,
  Eye,
  Send,
  Bot,
  KeyRound,
  Share2,
  LogOut,
  Settings,
  Terminal,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

const DAYS = [
  { id: 'mon', short: 'Пн', full: 'Понедельник' },
  { id: 'tue', short: 'Вт', full: 'Вторник' },
  { id: 'wed', short: 'Ср', full: 'Среда' },
  { id: 'thu', short: 'Чт', full: 'Четверг' },
  { id: 'fri', short: 'Пт', full: 'Пятница' },
  { id: 'sat', short: 'Сб', full: 'Суббота' },
];

const UNIVERSITIES = [
  'МГТУ им. Н.Э. Баумана',
  'НИУ ВШЭ (Высшая школа экономики)',
  'Университет ИТМО',
  'МГУ им. М.В. Ломоносова',
  'МФТИ (Физтех)',
  'СПбГУ',
  'УрФУ им. Б.Н. Ельцина',
  'РТУ МИРЭА',
  'КФУ (Казанский федеральный университет)',
  'НГУ (Новосибирский государственный университет)',
];

const STORAGE_KEY = 'starosta_vk_production_v1';

const EMPTY_DAILY_DEPUTY = {
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
};

const EMPTY_DAILY_REASON = {
  mon: 'both_absent',
  tue: 'both_absent',
  wed: 'both_absent',
  thu: 'both_absent',
  fri: 'both_absent',
  sat: 'both_absent',
};

export default function App() {
  const [darkMode, setDarkMode] = useState(false);

  // VK Bridge status & VK User info
  const [vkBridgeReady, setVkBridgeReady] = useState(false);
  const [vkUser, setVkUser] = useState(null);
  const [vkAppId, setVkAppId] = useState('51890000');

  // Onboarding / Entry Flow state: 'entry' (role selection) | 'app' (inside mini-app)
  const [screenMode, setScreenMode] = useState('entry');
  const [entryRoleStep, setEntryRoleStep] = useState('choose'); // 'choose' | 'starosta_create' | 'starosta_created_code' | 'student_join'

  // Group Metadata (null until created by Starosta or joined by Student)
  const [groupInfo, setGroupInfo] = useState(null);

  // Starosta creation form state (clean, no demo data)
  const [createGroupForm, setCreateGroupForm] = useState({
    groupName: '',
    university: UNIVERSITIES[0],
    customUniversity: '',
    faculty: '',
    course: '1 курс',
    starostaName: '',
    starostaVkTag: '',
    deputyName: '',
    deputyVkTag: '',
    initialWeekType: 'numerator',
  });

  // Student join form state (clean)
  const [studentJoinForm, setStudentJoinForm] = useState({
    studentName: '',
    studentVkTag: '',
    subgroup: 1,
    enteredCode: '',
    error: '',
  });

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'schedule' | 'homework' | 'attendance' | 'roles' | 'extras'
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [vkDeployModalOpen, setVkDeployModalOpen] = useState(false);

  // Clean production state (no demo data)
  const [members, setMembers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState('');

  // Daily replacement appointed by Starosta (null on all days by default -> banner is hidden until Starosta appoints someone)
  const [dailyDeputyByDay, setDailyDeputyByDay] = useState(EMPTY_DAILY_DEPUTY);
  const [dailyAbsenceReasonByDay, setDailyAbsenceReasonByDay] =
    useState(EMPTY_DAILY_REASON);

  const [dailyDeputyPermissions, setDailyDeputyPermissions] = useState({
    canManageHomework: true,
    canMarkAttendance: true,
    canManageQueues: true,
  });

  // Week & schedule state (empty by default)
  const [activeWeekType, setActiveWeekType] = useState('numerator');
  const [currentAcademicWeekType, setCurrentAcademicWeekType] =
    useState('numerator');
  const [selectedDay, setSelectedDay] = useState('mon');
  const [selectedSubgroup, setSelectedSubgroup] = useState(0);
  const [schedule, setSchedule] = useState([]);
  const [homeworks, setHomeworks] = useState([]);

  // Homework tab filters
  const [hwTabScope, setHwTabScope] = useState('next'); // 'next' | 'current' | 'all'
  const [hwFilterStatus, setHwFilterStatus] = useState('all'); // 'all' | 'pending' | 'done'
  const [hwSearchQuery, setHwSearchQuery] = useState('');

  // Attendance state
  const [attendanceSelectedPairId, setAttendanceSelectedPairId] = useState('');
  const [attendance, setAttendance] = useState({});

  // Extras state (empty by default)
  const [queues, setQueues] = useState([]);
  const [funds, setFunds] = useState([]);
  const [botBroadcasts, setBotBroadcasts] = useState([]);

  const [broadcastInput, setBroadcastInput] = useState({
    title: '',
    text: '',
    urgent: true,
  });

  // Modals & Toast state
  const [toastMessage, setToastMessage] = useState(null);
  const [hwModal, setHwModal] = useState({
    open: false,
    mode: 'add',
    scheduleId: '',
    targetWeekScope: 'current',
    hwId: null,
    title: '',
    description: '',
    attachment: '',
    priority: 'medium',
  });

  const [pairModal, setPairModal] = useState({
    open: false,
    weekType: 'numerator',
    day: 'mon',
    pairNumber: 1,
    time: '09:00 – 10:30',
    subject: '',
    type: 'Лекция',
    room: '',
    teacher: '',
    subgroup: 0,
  });

  const [newMemberModal, setNewMemberModal] = useState({
    open: false,
    name: '',
    vkTag: '',
    subgroup: 1,
    canManageHomework: false,
  });

  const [queueModal, setQueueModal] = useState({
    open: false,
    subject: '',
    dateLabel: '',
  });

  const [fundModal, setFundModal] = useState({
    open: false,
    title: '',
    amountPerPerson: '',
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  // Initialize VK Bridge & Load saved state from localStorage / VK Storage
  useEffect(() => {
    // Load persisted state if exists
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed.groupInfo) {
          setGroupInfo(parsed.groupInfo);
          setMembers(parsed.members || []);
          setCurrentUserId(parsed.currentUserId || '');
          setSchedule(parsed.schedule || []);
          setHomeworks(parsed.homeworks || []);
          setQueues(parsed.queues || []);
          setFunds(parsed.funds || []);
          setBotBroadcasts(parsed.botBroadcasts || []);
          setDailyDeputyByDay(parsed.dailyDeputyByDay || EMPTY_DAILY_DEPUTY);
          setDailyAbsenceReasonByDay(
            parsed.dailyAbsenceReasonByDay || EMPTY_DAILY_REASON
          );
          setAttendance(parsed.attendance || {});
          setCurrentAcademicWeekType(
            parsed.currentAcademicWeekType || 'numerator'
          );
          setActiveWeekType(parsed.currentAcademicWeekType || 'numerator');
          setScreenMode('app');
        }
      }
    } catch {
      // Ignore storage errors in sandboxed frames
    }

    // Check URL hash for direct #join=CODE link
    try {
      const hash = window.location.hash || '';
      if (hash.includes('join=')) {
        const codeParam = hash.split('join=')[1]?.split('&')[0];
        if (codeParam) {
          setStudentJoinForm((prev) => ({
            ...prev,
            enteredCode: decodeURIComponent(codeParam),
          }));
          setEntryRoleStep('student_join');
        }
      }
    } catch {
      // Ignore location hash errors
    }

    // Initialize VK Bridge if running inside VK environment
    const initVk = async () => {
      const bridge = window.vkBridge;
      if (bridge && typeof bridge.send === 'function') {
        try {
          await bridge.send('VKWebAppInit');
          setVkBridgeReady(true);
          const userInfo = await bridge.send('VKWebAppGetUserInfo');
          if (userInfo && userInfo.first_name) {
            const fullName = `${userInfo.first_name} ${userInfo.last_name || ''}`.trim();
            const vkTag = userInfo.id ? `@id${userInfo.id}` : '';
            setVkUser(userInfo);
            setCreateGroupForm((prev) => ({
              ...prev,
              starostaName: prev.starostaName || fullName,
              starostaVkTag: prev.starostaVkTag || vkTag,
            }));
            setStudentJoinForm((prev) => ({
              ...prev,
              studentName: prev.studentName || fullName,
              studentVkTag: prev.studentVkTag || vkTag,
            }));
          }
        } catch {
          // Running outside VK container
        }
      }
    };
    initVk();
  }, []);

  // Save state to localStorage + VK Storage whenever data changes
  useEffect(() => {
    if (!groupInfo) return;
    const payload = {
      groupInfo,
      members,
      currentUserId,
      schedule,
      homeworks,
      queues,
      funds,
      botBroadcasts,
      dailyDeputyByDay,
      dailyAbsenceReasonByDay,
      attendance,
      currentAcademicWeekType,
    };
    try {
      const serialized = JSON.stringify(payload);
      localStorage.setItem(STORAGE_KEY, serialized);
      if (vkBridgeReady && window.vkBridge) {
        window.vkBridge
          .send('VKWebAppStorageSet', {
            key: STORAGE_KEY,
            value: serialized,
          })
          .catch(() => {});
      }
    } catch {
      // Ignore quota or sandbox storage restrictions
    }
  }, [
    groupInfo,
    members,
    currentUserId,
    schedule,
    homeworks,
    queues,
    funds,
    botBroadcasts,
    dailyDeputyByDay,
    dailyAbsenceReasonByDay,
    attendance,
    currentAcademicWeekType,
    vkBridgeReady,
  ]);

  // Keep attendanceSelectedPairId synced when schedule gets first item
  useEffect(() => {
    if (!attendanceSelectedPairId && schedule.length > 0) {
      setAttendanceSelectedPairId(schedule[0].id);
    }
  }, [schedule, attendanceSelectedPairId]);

  const copyTextToClipboard = async (
    text,
    label = 'Скопировано в буфер обмена!'
  ) => {
    try {
      if (vkBridgeReady && window.vkBridge) {
        await window.vkBridge.send('VKWebAppCopyText', { text });
        showToast(label);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast(label);
    } catch {
      showToast(label);
    }
  };

  const shareInviteInVk = async () => {
    if (!groupInfo) return;
    if (vkBridgeReady && window.vkBridge) {
      try {
        await window.vkBridge.send('VKWebAppShare', {
          link: groupInfo.inviteLink,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    copyTextToClipboard(
      formattedInviteText,
      'Текст приглашения со ссылкой скопирован для отправки в ВК!'
    );
  };

  const resetAllData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setGroupInfo(null);
    setMembers([]);
    setCurrentUserId('');
    setSchedule([]);
    setHomeworks([]);
    setQueues([]);
    setFunds([]);
    setBotBroadcasts([]);
    setDailyDeputyByDay(EMPTY_DAILY_DEPUTY);
    setDailyAbsenceReasonByDay(EMPTY_DAILY_REASON);
    setAttendance({});
    setEntryRoleStep('choose');
    setScreenMode('entry');
    showToast('Все данные очищены. Вы можете создать новую группу с нуля.');
  };

  // Permanent leaders (Fixed roles)
  const permanentStarostaMember = useMemo(
    () =>
      members.find((m) => m.role === 'starosta') || {
        id: 'starosta_placeholder',
        name: 'Староста',
        vkTag: '@starosta',
        avatarColor: 'bg-blue-600',
      },
    [members]
  );

  const permanentDeputyMember = useMemo(
    () =>
      members.find((m) => m.role === 'deputy') || {
        id: 'deputy_placeholder',
        name: 'Не указан',
        vkTag: '',
        avatarColor: 'bg-purple-600',
      },
    [members]
  );

  const currentUser = useMemo(
    () =>
      members.find((m) => m.id === currentUserId) ||
      members[0] || {
        id: 'guest',
        name: 'Пользователь',
        vkTag: '',
        subgroup: 1,
        role: 'member',
        avatarColor: 'bg-blue-600',
        permissions: {
          canManageHomework: false,
          canMarkAttendance: false,
          canEditSchedule: false,
          canManageQueues: false,
          canPostAnnouncements: false,
        },
      },
    [members, currentUserId]
  );

  // Appointed person for the selected day (null if Starosta hasn't appointed anyone)
  const appointedDailyUserId = dailyDeputyByDay[selectedDay] || null;
  const dailyDeputyMember = useMemo(
    () =>
      appointedDailyUserId
        ? members.find((m) => m.id === appointedDailyUserId) || null
        : null,
    [members, appointedDailyUserId]
  );

  const isDailyDeputyToday =
    appointedDailyUserId !== null && appointedDailyUserId === currentUser.id;

  // Effective permissions for current user
  const effectivePermissions = useMemo(() => {
    if (currentUser.role === 'starosta') {
      return {
        canManageHomework: true,
        canMarkAttendance: true,
        canEditSchedule: true,
        canManageQueues: true,
        canPostAnnouncements: true,
        canSendBotBroadcast: true,
        canManageRoles: true,
        canAppointDailyReplacement: true,
      };
    }
    if (currentUser.role === 'deputy') {
      return {
        canManageHomework: currentUser.permissions?.canManageHomework ?? true,
        canMarkAttendance: currentUser.permissions?.canMarkAttendance ?? true,
        canEditSchedule: currentUser.permissions?.canEditSchedule ?? true,
        canManageQueues: currentUser.permissions?.canManageQueues ?? true,
        canPostAnnouncements:
          currentUser.permissions?.canPostAnnouncements ?? true,
        canSendBotBroadcast: true,
        canManageRoles: true,
        canAppointDailyReplacement: false,
      };
    }
    return {
      canManageHomework:
        Boolean(currentUser.permissions?.canManageHomework) ||
        (isDailyDeputyToday && dailyDeputyPermissions.canManageHomework),
      canMarkAttendance:
        Boolean(currentUser.permissions?.canMarkAttendance) ||
        (isDailyDeputyToday && dailyDeputyPermissions.canMarkAttendance),
      canEditSchedule: Boolean(currentUser.permissions?.canEditSchedule),
      canManageQueues:
        Boolean(currentUser.permissions?.canManageQueues) ||
        (isDailyDeputyToday && dailyDeputyPermissions.canManageQueues),
      canPostAnnouncements: Boolean(
        currentUser.permissions?.canPostAnnouncements
      ),
      canSendBotBroadcast: false,
      canManageRoles: false,
      canAppointDailyReplacement: false,
    };
  }, [currentUser, isDailyDeputyToday, dailyDeputyPermissions]);

  const nextAcademicWeekType =
    currentAcademicWeekType === 'numerator' ? 'denominator' : 'numerator';

  // Formatted invite text with group code & link
  const formattedInviteText = useMemo(() => {
    if (!groupInfo) return '';
    return `🎓 Присоединяйтесь к учебной группе «${groupInfo.name}» (${groupInfo.university}, ${groupInfo.course}) в мини-приложении Староста.ВК!\n\n🔑 Идентификатор (код) группы: ${groupInfo.code}\n🔗 Ссылка для вступления: ${groupInfo.inviteLink}\n\nВ приложении доступно расписание (числитель/знаменатель), домашние задания на каждую пару и план на следующую неделю.`;
  }, [groupInfo]);

  // Handle Starosta Group Creation (Clean start, only creates the Starosta & Deputy entered)
  const handleCreateGroupByStarosta = (e) => {
    e.preventDefault();
    const grpName = createGroupForm.groupName.trim();
    const starostaName = createGroupForm.starostaName.trim();
    const deputyName = createGroupForm.deputyName.trim();

    if (!grpName || !starostaName || !deputyName) {
      showToast('Заполните название группы, ФИО старосты и ФИО заместителя');
      return;
    }

    const uniName =
      createGroupForm.university === 'custom'
        ? createGroupForm.customUniversity.trim() || 'Учебное заведение'
        : createGroupForm.university;

    const cleanSlug =
      grpName
        .toUpperCase()
        .replace(/[^A-ZА-Я0-9]/g, '')
        .slice(0, 6) || 'GRP';
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const generatedCode = `VK-${cleanSlug}-${randomDigits}`;
    const generatedLink = `https://vk.com/app${vkAppId}#join=${generatedCode}`;

    const initialMembersList = [
      {
        id: 'u1',
        name: starostaName,
        vkTag: createGroupForm.starostaVkTag.trim() || '@starosta',
        subgroup: 1,
        role: 'starosta',
        avatarColor: 'bg-blue-600',
        permissions: {
          canManageHomework: true,
          canMarkAttendance: true,
          canEditSchedule: true,
          canManageQueues: true,
          canPostAnnouncements: true,
        },
      },
      {
        id: 'u2',
        name: deputyName,
        vkTag: createGroupForm.deputyVkTag.trim() || '@deputy',
        subgroup: 1,
        role: 'deputy',
        avatarColor: 'bg-purple-600',
        permissions: {
          canManageHomework: true,
          canMarkAttendance: true,
          canEditSchedule: true,
          canManageQueues: true,
          canPostAnnouncements: true,
        },
      },
    ];

    setGroupInfo({
      name: grpName,
      university: uniName,
      faculty: createGroupForm.faculty.trim() || 'Факультет не указан',
      course: createGroupForm.course,
      code: generatedCode,
      inviteLink: generatedLink,
    });

    setMembers(initialMembersList);
    setCurrentUserId('u1');
    setSchedule([]);
    setHomeworks([]);
    setQueues([]);
    setFunds([]);
    setBotBroadcasts([]);
    setDailyDeputyByDay(EMPTY_DAILY_DEPUTY);
    setDailyAbsenceReasonByDay(EMPTY_DAILY_REASON);
    setAttendance({});
    setCurrentAcademicWeekType(createGroupForm.initialWeekType);
    setActiveWeekType(createGroupForm.initialWeekType);

    setEntryRoleStep('starosta_created_code');
    showToast(`Группа «${grpName}» создана! Код: ${generatedCode}`);
  };

  // Handle Student Join by Group ID
  const handleStudentJoinGroup = (e) => {
    e.preventDefault();
    const cleanEntered = studentJoinForm.enteredCode.trim().toUpperCase();
    const studentName = studentJoinForm.studentName.trim();

    if (!cleanEntered) {
      setStudentJoinForm((prev) => ({
        ...prev,
        error: 'Пожалуйста, введите идентификатор (код) группы.',
      }));
      return;
    }

    if (!studentName) {
      setStudentJoinForm((prev) => ({
        ...prev,
        error: 'Пожалуйста, укажите ваше Имя и Фамилию.',
      }));
      return;
    }

    // If a group already exists on this instance, check code match
    if (groupInfo && cleanEntered !== groupInfo.code.toUpperCase()) {
      setStudentJoinForm((prev) => ({
        ...prev,
        error: `Неверный код группы. Проверьте код у старосты (код созданной группы: ${groupInfo.code}).`,
      }));
      return;
    }

    // If student joins via code before groupInfo was initialized locally, initialize group container from code
    if (!groupInfo) {
      const codeParts = cleanEntered.split('-');
      const inferredName = codeParts[1] || cleanEntered;
      setGroupInfo({
        name: inferredName,
        university: 'Подключенная группа ВК',
        faculty: '',
        course: '',
        code: cleanEntered,
        inviteLink: `https://vk.com/app${vkAppId}#join=${cleanEntered}`,
      });
    }

    // Check if student with same name already exists in members (e.g. Deputy added by Starosta)
    const existingMember = members.find(
      (m) => m.name.toLowerCase() === studentName.toLowerCase()
    );

    if (existingMember) {
      setCurrentUserId(existingMember.id);
      showToast(`Добро пожаловать в группу, ${existingMember.name}!`);
    } else {
      const newId = 'u_' + Date.now();
      const newStudent = {
        id: newId,
        name: studentName,
        vkTag: studentJoinForm.studentVkTag.trim() || '@vk_student',
        subgroup: Number(studentJoinForm.subgroup) || 1,
        role: 'member',
        avatarColor: 'bg-emerald-600',
        permissions: {
          canManageHomework: false,
          canMarkAttendance: false,
          canEditSchedule: false,
          canManageQueues: false,
          canPostAnnouncements: false,
        },
      };
      setMembers((prev) => [...prev, newStudent]);
      setCurrentUserId(newId);
      showToast(`Вы успешно вступили в группу по коду ${cleanEntered}!`);
    }

    setStudentJoinForm((prev) => ({ ...prev, error: '' }));
    setScreenMode('app');
  };

  // Handle Bot Broadcast Message
  const handleSendBotBroadcast = (e) => {
    e.preventDefault();
    if (!effectivePermissions.canSendBotBroadcast) {
      showToast(
        'Отправлять важные сообщения от имени бота могут только староста и заместитель старосты.'
      );
      return;
    }
    if (!broadcastInput.text.trim()) {
      showToast('Введите текст важного сообщения для рассылки');
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newBroadcast = {
      id: 'b_' + Date.now(),
      title:
        broadcastInput.title.trim() ||
        'Важное сообщение для всех участников группы',
      text: broadcastInput.text.trim(),
      senderName: currentUser.name,
      senderRoleLabel:
        currentUser.role === 'starosta'
          ? 'Староста группы'
          : 'Заместитель старосты',
      time: `Сегодня, ${timeStr}`,
      urgent: broadcastInput.urgent,
      deliveredCount: members.length,
    };

    setBotBroadcasts((prev) => [newBroadcast, ...prev]);
    setBroadcastInput({ title: '', text: '', urgent: true });
    showToast(
      `🤖 Отправлено от имени бота всем участникам группы (${members.length}/${members.length} чел.)!`
    );
  };

  // Helper to get homeworks for a schedule slot
  const getHomeworksForPair = (scheduleId, scopeFilter = null) => {
    return homeworks.filter((hw) => {
      if (hw.scheduleId !== scheduleId) return false;
      if (scopeFilter && hw.targetWeekScope !== scopeFilter) return false;
      return true;
    });
  };

  // Open Homework Modal
  const openAddHomeworkModal = (pair, defaultScope = null) => {
    if (!effectivePermissions.canManageHomework) {
      showToast('У вас нет прав на добавление/изменение ДЗ. Обратитесь к старосте.');
      return;
    }
    if (!pair) {
      showToast('Сначала добавьте хотя бы одну пару в расписание!');
      setPairModal((prev) => ({ ...prev, open: true }));
      return;
    }
    const inferredScope =
      defaultScope ||
      (pair.weekType === nextAcademicWeekType ? 'next' : 'current');
    setHwModal({
      open: true,
      mode: 'add',
      scheduleId: pair.id,
      targetWeekScope: inferredScope,
      hwId: null,
      title: '',
      description: '',
      attachment: '',
      priority: 'medium',
    });
  };

  const openEditHomeworkModal = (hw) => {
    if (!effectivePermissions.canManageHomework) {
      showToast('У вас нет прав на редактирование ДЗ.');
      return;
    }
    setHwModal({
      open: true,
      mode: 'edit',
      scheduleId: hw.scheduleId,
      targetWeekScope: hw.targetWeekScope,
      hwId: hw.id,
      title: hw.title,
      description: hw.description,
      attachment: hw.attachment || '',
      priority: hw.priority || 'medium',
    });
  };

  const saveHomework = () => {
    if (!hwModal.scheduleId) {
      showToast('Выберите пару из расписания!');
      return;
    }
    if (!hwModal.title.trim()) {
      showToast('Введите задание!');
      return;
    }
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
    if (hwModal.mode === 'add') {
      const newHw = {
        id: 'hw_' + Date.now(),
        scheduleId: hwModal.scheduleId,
        targetWeekScope: hwModal.targetWeekScope,
        title: hwModal.title.trim(),
        description: hwModal.description.trim(),
        attachment: hwModal.attachment.trim(),
        priority: hwModal.priority,
        authorName: currentUser.name,
        updatedAt: `Сегодня, ${timeStr}`,
        completedBy: [],
      };
      setHomeworks((prev) => [newHw, ...prev]);
      showToast('Домашнее задание добавлено к паре!');
    } else {
      setHomeworks((prev) =>
        prev.map((item) =>
          item.id === hwModal.hwId
            ? {
                ...item,
                scheduleId: hwModal.scheduleId,
                targetWeekScope: hwModal.targetWeekScope,
                title: hwModal.title.trim(),
                description: hwModal.description.trim(),
                attachment: hwModal.attachment.trim(),
                priority: hwModal.priority,
                authorName: currentUser.name,
                updatedAt: `Изменено в ${timeStr}`,
              }
            : item
        )
      );
      showToast('Домашнее задание обновлено!');
    }
    setHwModal((prev) => ({ ...prev, open: false }));
  };

  const deleteHomework = (hwId) => {
    if (!effectivePermissions.canManageHomework) {
      showToast('Нет доступа к удалению ДЗ');
      return;
    }
    setHomeworks((prev) => prev.filter((h) => h.id !== hwId));
    showToast('Домашнее задание удалено');
  };

  const toggleHomeworkCompleted = (hwId) => {
    setHomeworks((prev) =>
      prev.map((hw) => {
        if (hw.id !== hwId) return hw;
        const done = hw.completedBy.includes(currentUser.id);
        return {
          ...hw,
          completedBy: done
            ? hw.completedBy.filter((id) => id !== currentUser.id)
            : [...hw.completedBy, currentUser.id],
        };
      })
    );
  };

  // Toggle member permission
  const toggleMemberPermission = (memberId, permKey) => {
    if (!effectivePermissions.canManageRoles) {
      showToast('Только староста или зам может менять права участников');
      return;
    }
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        if (m.role === 'starosta') return m;
        return {
          ...m,
          permissions: {
            ...m.permissions,
            [permKey]: !m.permissions[permKey],
          },
        };
      })
    );
    showToast('Права доступа участника обновлены');
  };

  // Appoint or clear Daily Replacement (ONLY Starosta can appoint)
  const appointDailyDeputy = (dayId, memberIdOrNull) => {
    if (currentUser.role !== 'starosta') {
      showToast('Назначать человека на день может только лично староста!');
      return;
    }
    setDailyDeputyByDay((prev) => ({
      ...prev,
      [dayId]: memberIdOrNull || null,
    }));
    if (!memberIdOrNull) {
      showToast('Назначение на день снято. Плашка отсутствия скрыта.');
    } else {
      const chosen = members.find((m) => m.id === memberIdOrNull);
      if (chosen) {
        showToast(
          `Староста назначил(а) на ${
            DAYS.find((d) => d.id === dayId)?.full
          }: ${chosen.name}`
        );
      }
    }
  };

  const pickRandomDailyDeputy = (dayId) => {
    if (currentUser.role !== 'starosta') {
      showToast('Назначать человека на день может только староста!');
      return;
    }
    const candidates = members.filter(
      (m) => m.role !== 'starosta' && m.role !== 'deputy'
    );
    if (candidates.length === 0) {
      showToast('Сначала добавьте студентов в группу, чтобы выбрать замену на день.');
      return;
    }
    const randomMember =
      candidates[Math.floor(Math.random() * candidates.length)];
    if (randomMember) {
      setDailyDeputyByDay((prev) => ({ ...prev, [dayId]: randomMember.id }));
      showToast(`Староста назначил(а) на день (случайно): ${randomMember.name}`);
    }
  };

  // Schedule Pair Creation & Deletion
  const handleAddSchedulePair = () => {
    if (!pairModal.subject.trim()) {
      showToast('Укажите название предмета');
      return;
    }
    const newPair = {
      id: 's_' + Date.now(),
      weekType: pairModal.weekType,
      day: pairModal.day,
      pairNumber: Number(pairModal.pairNumber),
      time: pairModal.time,
      subject: pairModal.subject.trim(),
      type: pairModal.type,
      room: pairModal.room.trim() || 'Ауд. не указана',
      teacher: pairModal.teacher.trim() || 'Преподаватель не указан',
      subgroup: Number(pairModal.subgroup),
    };
    setSchedule((prev) => [...prev, newPair]);
    if (!attendanceSelectedPairId) {
      setAttendanceSelectedPairId(newPair.id);
    }
    setPairModal((prev) => ({
      ...prev,
      open: false,
      subject: '',
      room: '',
      teacher: '',
    }));
    showToast('Пара добавлена в расписание');
  };

  const deleteSchedulePair = (pairId) => {
    if (!effectivePermissions.canEditSchedule) {
      showToast('Нет прав на удаление пары из расписания');
      return;
    }
    setSchedule((prev) => prev.filter((p) => p.id !== pairId));
    setHomeworks((prev) => prev.filter((hw) => hw.scheduleId !== pairId));
    showToast('Пара удалена из расписания');
  };

  // Attendance helpers
  const setStudentAttendance = (scheduleId, studentId, status) => {
    if (!effectivePermissions.canMarkAttendance) {
      showToast('У вас нет прав отмечать посещаемость');
      return;
    }
    setAttendance((prev) => ({
      ...prev,
      [`${scheduleId}_${studentId}`]: status,
    }));
  };

  const markAllPresent = (scheduleId) => {
    if (!effectivePermissions.canMarkAttendance) {
      showToast('У вас нет прав отмечать посещаемость');
      return;
    }
    if (!scheduleId) {
      showToast('Сначала выберите пару из расписания');
      return;
    }
    const next = { ...attendance };
    members.forEach((m) => {
      next[`${scheduleId}_${m.id}`] = 'present';
    });
    setAttendance(next);
    showToast('Все участники отмечены как присутствующие');
  };

  // Filtered schedule for current view
  const filteredSchedule = useMemo(() => {
    return schedule
      .filter((s) => s.weekType === activeWeekType && s.day === selectedDay)
      .filter(
        (s) =>
          selectedSubgroup === 0 ||
          s.subgroup === 0 ||
          s.subgroup === selectedSubgroup
      )
      .sort((a, b) => a.pairNumber - b.pairNumber);
  }, [schedule, activeWeekType, selectedDay, selectedSubgroup]);

  // Next week homework grouped by day & pair
  const nextWeekHomeworksGrouped = useMemo(() => {
    return DAYS.map((d) => {
      const pairsOnDay = schedule
        .filter((s) => s.weekType === nextAcademicWeekType && s.day === d.id)
        .sort((a, b) => a.pairNumber - b.pairNumber);

      const pairsWithHw = pairsOnDay.map((pair) => {
        const pairHws = homeworks.filter(
          (hw) => hw.scheduleId === pair.id && hw.targetWeekScope === 'next'
        );
        return { pair, pairHws };
      });

      const totalHwsOnDay = pairsWithHw.reduce(
        (acc, item) => acc + item.pairHws.length,
        0
      );

      return {
        day: d,
        pairsWithHw,
        totalHwsOnDay,
      };
    });
  }, [schedule, homeworks, nextAcademicWeekType]);

  // Homework Managers list
  const homeworkManagers = useMemo(() => {
    return members.filter(
      (m) =>
        m.role === 'starosta' ||
        m.permissions?.canManageHomework ||
        dailyDeputyByDay[selectedDay] === m.id
    );
  }, [members, dailyDeputyByDay, selectedDay]);

  // Absence label helper
  const currentAbsenceText = useMemo(() => {
    const reason = dailyAbsenceReasonByDay[selectedDay] || 'both_absent';
    if (reason === 'both_absent') {
      return `Староста (${permanentStarostaMember.name}) и заместитель старосты (${permanentDeputyMember.name}) сегодня отсутствуют`;
    }
    if (reason === 'deputy_absent') {
      return `Заместитель старосты (${permanentDeputyMember.name}) сегодня отсутствует`;
    }
    return `Староста (${permanentStarostaMember.name}) сегодня отсутствует`;
  }, [
    dailyAbsenceReasonByDay,
    selectedDay,
    permanentStarostaMember,
    permanentDeputyMember,
  ]);

  // ==================== ONBOARDING / ROLE SELECTION SCREEN (CLEAN, NO DEMO DATA) ====================
  if (screenMode === 'entry') {
    return (
      <div
        className={`min-h-screen font-sans flex flex-col justify-between p-4 sm:p-6 transition-colors ${
          darkMode
            ? 'bg-slate-950 text-slate-100'
            : 'bg-[#EBEDF0] text-slate-900'
        }`}
      >
        {/* Top bar */}
        <div className="max-w-3xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#2688EB] flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight">
                Староста.ВК
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#2688EB]/15 text-[#2688EB]">
                VK Mini Apps {vkBridgeReady ? '• VK Bridge подключен' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {groupInfo && (
              <button
                onClick={() => setScreenMode('app')}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#2688EB] text-white hover:bg-blue-600 transition"
              >
                Вернуться в группу «{groupInfo.name}» →
              </button>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl border ${
                darkMode
                  ? 'bg-slate-900 border-slate-800 text-amber-400'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Center card */}
        <div className="max-w-2xl w-full mx-auto my-6">
          {entryRoleStep === 'choose' && (
            <div
              className={`rounded-3xl border p-6 sm:p-8 space-y-6 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/90 shadow-sm'
              }`}
            >
              <div className="text-center space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2688EB]/10 text-[#2688EB] text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" /> Рабочая версия для ВКонтакте (без демо-данных)
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold">
                  Выберите вашу роль в группе
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  Староста регистрирует учебную группу с нуля и получает код приглашения, а студенты входят по коду своей группы.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option 1: Starosta */}
                <button
                  onClick={() => setEntryRoleStep('starosta_create')}
                  className={`p-5 rounded-2xl border-2 text-left transition group hover:border-[#2688EB] ${
                    darkMode
                      ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
                      : 'bg-blue-50/40 border-blue-200/80 hover:bg-blue-50/80'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#2688EB] text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-base sm:text-lg flex items-center justify-between">
                    <span>Я Староста</span>
                    <ChevronRight className="w-5 h-5 text-[#2688EB]" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Создать новую группу, указать название, выбрать ВУЗ и факультет, получить уникальный код и ссылку для приглашения студентов.
                  </p>
                </button>

                {/* Option 2: Student */}
                <button
                  onClick={() => setEntryRoleStep('student_join')}
                  className={`p-5 rounded-2xl border-2 text-left transition group hover:border-emerald-500 ${
                    darkMode
                      ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
                      : 'bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/80'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-base sm:text-lg flex items-center justify-between">
                    <span>Я Студент</span>
                    <ChevronRight className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Ввести идентификатор (код) группы, полученный от старосты, чтобы смотреть расписание, ДЗ на следующую неделю и отмечаться в очереди.
                  </p>
                </button>
              </div>

              {groupInfo && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                    darkMode
                      ? 'bg-slate-800/40 border-slate-800 text-slate-300'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span>
                    Сохраненная группа на устройстве: <strong>{groupInfo.name}</strong> ({groupInfo.university}) • Код: <strong className="text-[#2688EB]">{groupInfo.code}</strong>
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setScreenMode('app')}
                      className="text-[#2688EB] font-bold hover:underline"
                    >
                      Войти →
                    </button>
                    <button
                      onClick={resetAllData}
                      className="text-rose-500 font-semibold hover:underline"
                    >
                      Удалить группу
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 1A: STAROSTA CREATES GROUP */}
          {entryRoleStep === 'starosta_create' && (
            <form
              onSubmit={handleCreateGroupByStarosta}
              className={`rounded-3xl border p-6 sm:p-8 space-y-4 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/90 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#2688EB]">
                    Регистрация старосты
                  </span>
                  <h2 className="text-lg sm:text-xl font-extrabold">
                    Создание учебной группы в ВУЗе
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEntryRoleStep('choose')}
                  className="text-xs px-3 py-1.5 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 font-semibold"
                >
                  ← Назад
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div>
                  <label className="block font-semibold mb-1">
                    Название учебной группы *:
                  </label>
                  <input
                    type="text"
                    required
                    value={createGroupForm.groupName}
                    onChange={(e) =>
                      setCreateGroupForm({
                        ...createGroupForm,
                        groupName: e.target.value,
                      })
                    }
                    placeholder="Введите шифр/номер группы"
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-semibold ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Курс обучения:</label>
                  <select
                    value={createGroupForm.course}
                    onChange={(e) =>
                      setCreateGroupForm({
                        ...createGroupForm,
                        course: e.target.value,
                      })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-semibold ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="1 курс">1 курс</option>
                    <option value="2 курс">2 курс</option>
                    <option value="3 курс">3 курс</option>
                    <option value="4 курс">4 курс</option>
                    <option value="5 курс">5 курс</option>
                    <option value="1 курс Магистратуры">1 курс Магистратуры</option>
                    <option value="2 курс Магистратуры">2 курс Магистратуры</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 text-xs sm:text-sm">
                <div>
                  <label className="block font-semibold mb-1">
                    Учебное заведение (ВУЗ):
                  </label>
                  <select
                    value={createGroupForm.university}
                    onChange={(e) =>
                      setCreateGroupForm({
                        ...createGroupForm,
                        university: e.target.value,
                      })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-semibold ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {UNIVERSITIES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="custom">+ Ввести свой ВУЗ вручную...</option>
                  </select>
                </div>

                {createGroupForm.university === 'custom' && (
                  <div>
                    <label className="block font-semibold mb-1">
                      Название вашего учебного заведения *:
                    </label>
                    <input
                      type="text"
                      required
                      value={createGroupForm.customUniversity}
                      onChange={(e) =>
                        setCreateGroupForm({
                          ...createGroupForm,
                          customUniversity: e.target.value,
                        })
                      }
                      placeholder="Введите название ВУЗа"
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold mb-1">
                    Факультет / Институт / Кафедра:
                  </label>
                  <input
                    type="text"
                    value={createGroupForm.faculty}
                    onChange={(e) =>
                      setCreateGroupForm({
                        ...createGroupForm,
                        faculty: e.target.value,
                      })
                    }
                    placeholder="Укажите факультет или институт"
                    className={`w-full px-3.5 py-2.5 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">
                      ФИО Старосты (закрепляется постоянно) *:
                    </label>
                    <input
                      type="text"
                      required
                      value={createGroupForm.starostaName}
                      onChange={(e) =>
                        setCreateGroupForm({
                          ...createGroupForm,
                          starostaName: e.target.value,
                        })
                      }
                      placeholder="Ваше Имя и Фамилия"
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">
                      ФИО Заместителя старосты (постоянный) *:
                    </label>
                    <input
                      type="text"
                      required
                      value={createGroupForm.deputyName}
                      onChange={(e) =>
                        setCreateGroupForm({
                          ...createGroupForm,
                          deputyName: e.target.value,
                        })
                      }
                      placeholder="Имя и Фамилия заместителя"
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    Какая сейчас идет учебная неделя?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCreateGroupForm({
                          ...createGroupForm,
                          initialWeekType: 'numerator',
                        })
                      }
                      className={`py-2.5 px-3 rounded-xl border font-semibold text-xs ${
                        createGroupForm.initialWeekType === 'numerator'
                          ? 'border-[#2688EB] bg-[#2688EB] text-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Числитель (Верхняя неделя)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCreateGroupForm({
                          ...createGroupForm,
                          initialWeekType: 'denominator',
                        })
                      }
                      className={`py-2.5 px-3 rounded-xl border font-semibold text-xs ${
                        createGroupForm.initialWeekType === 'denominator'
                          ? 'border-[#2688EB] bg-[#2688EB] text-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Знаменатель (Нижняя неделя)
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#2688EB] hover:bg-blue-600 text-white font-bold text-sm shadow-sm transition"
              >
                Создать группу и сгенерировать код со ссылкой
              </button>
            </form>
          )}

          {/* STEP 1B: GENERATED GROUP CODE & INVITE LINK SCREEN */}
          {entryRoleStep === 'starosta_created_code' && groupInfo && (
            <div
              className={`rounded-3xl border p-6 sm:p-8 space-y-5 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/90 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                    Группа создана и готова к работе
                  </span>
                  <h2 className="text-lg sm:text-xl font-extrabold">
                    {groupInfo.name} • {groupInfo.university}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {groupInfo.faculty} ({groupInfo.course})
                  </p>
                </div>
              </div>

              {/* Generated Group Code Box */}
              <div
                className={`p-4 rounded-2xl border-2 border-[#2688EB]/40 flex flex-wrap items-center justify-between gap-3 ${
                  darkMode ? 'bg-slate-800/70' : 'bg-blue-50/60'
                }`}
              >
                <div>
                  <div className="text-xs text-slate-500 font-medium">
                    Уникальный идентификатор (код) вашей группы:
                  </div>
                  <div className="text-xl sm:text-2xl font-black tracking-wider text-[#2688EB] mt-0.5">
                    {groupInfo.code}
                  </div>
                </div>
                <button
                  onClick={() =>
                    copyTextToClipboard(
                      groupInfo.code,
                      `Код группы ${groupInfo.code} скопирован!`
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-[#2688EB] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-blue-600"
                >
                  <Copy className="w-4 h-4" /> Скопировать код
                </button>
              </div>

              {/* Generated Invite Text & Link Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Текст со ссылкой для отправки в беседу группы ВК:
                  </span>
                  <button
                    onClick={shareInviteInVk}
                    className="text-xs text-[#2688EB] font-bold hover:underline flex items-center gap-1"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Поделиться / Скопировать текст
                  </button>
                </div>
                <pre
                  className={`p-3.5 rounded-2xl border text-xs whitespace-pre-wrap font-sans leading-relaxed ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {formattedInviteText}
                </pre>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => {
                    setStudentJoinForm((prev) => ({
                      ...prev,
                      enteredCode: groupInfo.code,
                    }));
                    setEntryRoleStep('student_join');
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-500/10"
                >
                  Войти как Студент по этому коду
                </button>

                <button
                  onClick={() => setScreenMode('app')}
                  className="px-5 py-2.5 rounded-xl bg-[#2688EB] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm"
                >
                  Перейти к заполнению расписания <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: STUDENT JOINS BY GROUP ID */}
          {entryRoleStep === 'student_join' && (
            <form
              onSubmit={handleStudentJoinGroup}
              className={`rounded-3xl border p-6 sm:p-8 space-y-4 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/90 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                    Вход для студента
                  </span>
                  <h2 className="text-lg sm:text-xl font-extrabold">
                    Вступление в группу по идентификатору
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEntryRoleStep('choose')}
                  className="text-xs px-3 py-1.5 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 font-semibold"
                >
                  ← Назад
                </button>
              </div>

              {/* Group ID input */}
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-bold">
                  Идентификатор (код) вашей группы *:
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={studentJoinForm.enteredCode}
                      onChange={(e) =>
                        setStudentJoinForm({
                          ...studentJoinForm,
                          enteredCode: e.target.value,
                          error: '',
                        })
                      }
                      placeholder="Введите код группы от старосты"
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border font-bold tracking-wider uppercase text-sm ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                  {groupInfo && (
                    <button
                      type="button"
                      onClick={() =>
                        setStudentJoinForm({
                          ...studentJoinForm,
                          enteredCode: groupInfo.code,
                          error: '',
                        })
                      }
                      className="px-3 py-2.5 rounded-xl bg-[#2688EB]/10 text-[#2688EB] text-xs font-bold hover:bg-[#2688EB]/20 shrink-0"
                    >
                      Вставить {groupInfo.code}
                    </button>
                  )}
                </div>
              </div>

              {studentJoinForm.error && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{studentJoinForm.error}</span>
                </div>
              )}

              {/* Student Name & Subgroup */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">
                    Ваше Имя и Фамилия *:
                  </label>
                  <input
                    type="text"
                    required
                    value={studentJoinForm.studentName}
                    onChange={(e) =>
                      setStudentJoinForm({
                        ...studentJoinForm,
                        studentName: e.target.value,
                        error: '',
                      })
                    }
                    placeholder="Иван Иванов"
                    className={`w-full px-3.5 py-2.5 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Подгруппа:</label>
                  <select
                    value={studentJoinForm.subgroup}
                    onChange={(e) =>
                      setStudentJoinForm({
                        ...studentJoinForm,
                        subgroup: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-semibold ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value={1}>1 подгруппа</option>
                    <option value={2}>2 подгруппа</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition"
              >
                Войти в группу по идентификатору
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400">
          Староста.ВК • Готово к публикации в VK Mini Apps
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs sm:text-sm font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // ==================== MAIN APPLICATION VIEW ====================
  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-200 ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#EBEDF0] text-slate-900'
      }`}
    >
      {/* Top VK Mini App Header */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          darkMode
            ? 'bg-slate-900/95 border-slate-800'
            : 'bg-white/95 border-slate-200'
        }`}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
          {/* App Brand & Group Metadata */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2688EB] flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-sm sm:text-base tracking-tight">
                  Группа {groupInfo?.name || 'Новая группа'} —{' '}
                  {groupInfo?.university || 'ВУЗ'}
                </h1>
                {groupInfo?.code && (
                  <button
                    onClick={() => setInviteModalOpen(true)}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#2688EB]/15 text-[#2688EB] hover:bg-[#2688EB]/25 flex items-center gap-1"
                    title="Показать код группы и ссылку для приглашения"
                  >
                    <KeyRound className="w-3 h-3" /> Код: {groupInfo.code}
                  </button>
                )}
              </div>
              <p
                className={`text-xs ${
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Текущая неделя:{' '}
                <strong className="text-[#2688EB]">
                  {currentAcademicWeekType === 'numerator'
                    ? 'Числитель (верхняя)'
                    : 'Знаменатель (нижняя)'}
                </strong>{' '}
                • След. неделя:{' '}
                <span>
                  {nextAcademicWeekType === 'numerator'
                    ? 'Числитель'
                    : 'Знаменатель'}
                </span>
              </p>
            </div>
          </div>

          {/* Interactive Role Switcher, VK Deploy Button, Entry Screen Button & Theme */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setVkDeployModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#2688EB] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-600 shadow-xs"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Подключение к ВК</span>
            </button>

            <button
              onClick={() => {
                setEntryRoleStep('choose');
                setScreenMode('entry');
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
              title="Вернуться на стартовый экран выбора роли (Староста / Студент)"
            >
              <LogOut className="w-3.5 h-3.5 text-[#2688EB]" />
              <span>Сменить роль</span>
            </button>

            {members.length > 0 && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-slate-100 border-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-[#2688EB]" />
                <select
                  value={currentUserId}
                  onChange={(e) => {
                    setCurrentUserId(e.target.value);
                    const chosen = members.find((m) => m.id === e.target.value);
                    if (chosen) {
                      showToast(`Активный профиль: ${chosen.name}`);
                    }
                  }}
                  className="bg-transparent font-semibold focus:outline-none cursor-pointer"
                >
                  {members.map((m) => (
                    <option
                      key={m.id}
                      value={m.id}
                      className={
                        darkMode
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-900'
                      }
                    >
                      {m.name} (
                      {m.role === 'starosta'
                        ? 'Староста — пост.'
                        : m.role === 'deputy'
                        ? 'Замстаросты — пост.'
                        : dailyDeputyByDay[selectedDay] === m.id
                        ? 'Назначен на день'
                        : m.permissions?.canManageHomework
                        ? 'Редактор ДЗ'
                        : 'Студент'}
                      )
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl border transition ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
              title="Переключить тему"
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="max-w-6xl mx-auto px-3 sm:px-5 flex items-center gap-1 overflow-x-auto no-scrollbar pb-2">
          {[
            { id: 'dashboard', label: 'Сегодня & Рассылка бота', icon: Sparkles },
            { id: 'schedule', label: 'Расписание + ДЗ на пару', icon: Calendar },
            {
              id: 'homework',
              label: 'Что делать на след. неделю',
              icon: BookOpen,
              badge: homeworks.filter((h) => h.targetWeekScope === 'next')
                .length,
            },
            { id: 'roles', label: 'Роли, Замы и Доступ к ДЗ', icon: Shield },
            { id: 'attendance', label: 'Журнал явки', icon: UserCheck },
            { id: 'extras', label: 'Очередь и Сборы', icon: ListOrdered },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                  active
                    ? 'bg-[#2688EB] text-white shadow-sm'
                    : darkMode
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                      active
                        ? 'bg-white text-[#2688EB]'
                        : 'bg-[#2688EB]/15 text-[#2688EB]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Active User Status Banner + Conditional Daily Replacement Banner (Requirement 4b) */}
      <div className="max-w-6xl mx-auto px-3 sm:px-5 pt-3 space-y-2.5">
        <div
          className={`rounded-2xl px-3.5 py-2.5 border flex flex-wrap items-center justify-between gap-2 text-xs ${
            darkMode
              ? 'bg-slate-900/90 border-slate-800'
              : 'bg-white border-slate-200/80 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`w-6 h-6 rounded-full text-white font-bold flex items-center justify-center ${
                currentUser.avatarColor || 'bg-blue-600'
              }`}
            >
              {currentUser.name ? currentUser.name[0] : 'У'}
            </span>
            <span className="font-semibold">{currentUser.name}</span>
            <span className="text-slate-400">•</span>
            <span>
              Староста: <strong>{permanentStarostaMember.name}</strong> | Зам:{' '}
              <strong>{permanentDeputyMember.name}</strong> (неизменны)
            </span>
            <span className="text-slate-400">•</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                effectivePermissions.canManageHomework
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
              }`}
            >
              {effectivePermissions.canManageHomework ? (
                <Unlock className="w-3 h-3" />
              ) : (
                <Lock className="w-3 h-3" />
              )}
              ДЗ: {effectivePermissions.canManageHomework ? 'Редактирование' : 'Просмотр'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setInviteModalOpen(true)}
              className="text-[#2688EB] hover:underline font-medium flex items-center gap-1"
            >
              <Share2 className="w-3.5 h-3.5" />
              Пригласить студентов
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className="text-[#2688EB] hover:underline font-medium flex items-center gap-1"
            >
              <Shield className="w-3.5 h-3.5" />
              Роли и права ДЗ
            </button>
          </div>
        </div>

        {/* REQUIREMENT 4B: CONDITIONAL BANNER — APPEARS ONLY IF STAROSTA HAS APPOINTED SOMEONE FOR THIS DAY */}
        {dailyDeputyMember !== null && (
          <div
            className={`rounded-2xl p-3.5 border-2 border-amber-500/50 flex flex-wrap items-center justify-between gap-3 ${
              darkMode
                ? 'bg-amber-950/30 text-amber-100'
                : 'bg-amber-50/90 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500 text-white">
                    Замена на {DAYS.find((d) => d.id === selectedDay)?.full}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300">
                    {currentAbsenceText}
                  </span>
                </div>
                <p className="text-xs mt-1">
                  Решением старосты на этот день исполняющим обязанности назначен(а):{' '}
                  <strong className="underline">{dailyDeputyMember.name}</strong> (
                  {dailyDeputyMember.vkTag}). Ему(ей) временно открыты права на ведение журнала и ДЗ.
                </p>
              </div>
            </div>

            {currentUser.role === 'starosta' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('roles')}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-semibold"
                >
                  Изменить
                </button>
                <button
                  onClick={() => appointDailyDeputy(selectedDay, null)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 text-xs font-semibold"
                  title="Снять назначение (плашка исчезнет с экрана)"
                >
                  Снять назначение
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-3 sm:px-5 py-4 space-y-4">
        {/* ==================== TAB 1: DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {/* Top summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Week Switcher */}
              <div
                className={`p-4 rounded-2xl border ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#2688EB]">
                    Учебный цикл
                  </span>
                  <button
                    onClick={() => {
                      const next =
                        currentAcademicWeekType === 'numerator'
                          ? 'denominator'
                          : 'numerator';
                      setCurrentAcademicWeekType(next);
                      setActiveWeekType(next);
                      showToast(
                        `Текущая неделя переключена на: ${
                          next === 'numerator' ? 'Числитель' : 'Знаменатель'
                        }`
                      );
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-[#2688EB]/10 text-[#2688EB] hover:bg-[#2688EB]/20 font-medium transition"
                  >
                    Сменить неделю
                  </button>
                </div>
                <div className="text-lg font-bold">
                  Сейчас:{' '}
                  {currentAcademicWeekType === 'numerator'
                    ? 'Числитель (I)'
                    : 'Знаменатель (II)'}
                </div>
                <p
                  className={`text-xs mt-1 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Следующая неделя автоматически считается как{' '}
                  <strong>
                    {nextAcademicWeekType === 'numerator'
                      ? 'Числитель'
                      : 'Знаменатель'}
                  </strong>
                  .
                </p>
              </div>

              {/* Card 2: Permanent Leaders + Quick Daily Appointment by Starosta */}
              <div
                className={`p-4 rounded-2xl border ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-500">
                    Руководство группы (постоянное)
                  </span>
                  {currentUser.role === 'starosta' && (
                    <button
                      onClick={() => pickRandomDailyDeputy(selectedDay)}
                      className="text-xs px-2 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 font-medium flex items-center gap-1"
                      title="Случайно назначить дежурного на выбранный день"
                    >
                      <Shuffle className="w-3 h-3" /> Случайно
                    </button>
                  )}
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    Староста: <strong>{permanentStarostaMember.name}</strong>
                  </div>
                  <div>
                    Замстаросты: <strong>{permanentDeputyMember.name}</strong>
                  </div>
                  <div className="pt-1 text-slate-500">
                    {dailyDeputyMember ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        На {DAYS.find((d) => d.id === selectedDay)?.short} назначен(а):{' '}
                        {dailyDeputyMember.name}
                      </span>
                    ) : (
                      <span>
                        На {DAYS.find((d) => d.id === selectedDay)?.short} замена не
                        назначалась (плашка скрыта)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 3: Quick Next Week Homework Counter */}
              <div
                className={`p-4 rounded-2xl border ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                    План на следующую неделю
                  </span>
                  <button
                    onClick={() => {
                      setHwTabScope('next');
                      setActiveTab('homework');
                    }}
                    className="text-xs text-[#2688EB] font-medium hover:underline flex items-center gap-1"
                  >
                    Открыть план <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-lg font-bold">
                  {homeworks.filter((h) => h.targetWeekScope === 'next').length}{' '}
                  заданий на след. неделю
                </div>
                <p
                  className={`text-xs mt-1 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Участников в группе: <strong>{members.length} чел.</strong> • Редакторов ДЗ: <strong>{homeworkManagers.length}</strong>
                </p>
              </div>
            </div>

            {/* REQUIREMENT 4A: IMPORTANT MESSAGES WINDOW FOR STAROSTA & DEPUTY (BOT BROADCAST) */}
            <div
              className={`p-4 sm:p-5 rounded-2xl border-2 border-[#2688EB]/30 ${
                darkMode
                  ? 'bg-slate-900'
                  : 'bg-gradient-to-r from-blue-50/60 via-white to-indigo-50/40 shadow-xs'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#2688EB] text-white flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-sm sm:text-base">
                        Важные сообщения группы (Рассылка от имени бота ВК)
                      </h2>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#2688EB]/15 text-[#2688EB]">
                        Получателей: {members.length} чел.
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Сообщения, отправленные старостой или заместителем старосты, рассылаются всем участникам группы от имени бота.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left: Send form (only for Starosta and Permanent Deputy) */}
                <div className="lg:col-span-5">
                  {effectivePermissions.canSendBotBroadcast ? (
                    <form
                      onSubmit={handleSendBotBroadcast}
                      className={`p-3.5 rounded-xl border space-y-2.5 ${
                        darkMode
                          ? 'bg-slate-800/70 border-slate-700'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#2688EB] flex items-center gap-1">
                          <Send className="w-3.5 h-3.5" /> Отправить сообщение от имени бота
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {currentUser.role === 'starosta' ? 'Староста' : 'Замстаросты'}
                        </span>
                      </div>

                      <input
                        type="text"
                        value={broadcastInput.title}
                        onChange={(e) =>
                          setBroadcastInput({
                            ...broadcastInput,
                            title: e.target.value,
                          })
                        }
                        placeholder="Тема сообщения"
                        className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold ${
                          darkMode
                            ? 'bg-slate-900 border-slate-700'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      />

                      <textarea
                        rows={3}
                        value={broadcastInput.text}
                        onChange={(e) =>
                          setBroadcastInput({
                            ...broadcastInput,
                            text: e.target.value,
                          })
                        }
                        placeholder="Введите текст важного сообщения для всей группы..."
                        className={`w-full px-3 py-2 rounded-lg border text-xs ${
                          darkMode
                            ? 'bg-slate-900 border-slate-700'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      />

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={broadcastInput.urgent}
                            onChange={(e) =>
                              setBroadcastInput({
                                ...broadcastInput,
                                urgent: e.target.checked,
                              })
                            }
                            className="rounded text-[#2688EB]"
                          />
                          <span className="font-medium">Пометить как «Важно»</span>
                        </label>

                        <button
                          type="submit"
                          className="px-3.5 py-2 rounded-xl bg-[#2688EB] hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" /> Разослать всем
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      className={`p-4 rounded-xl border h-full flex flex-col justify-center text-xs space-y-2 ${
                        darkMode
                          ? 'bg-slate-800/40 border-slate-800 text-slate-400'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                        <Lock className="w-4 h-4 text-[#2688EB]" /> Доступно старосте и заместителю
                      </div>
                      <p>
                        Отправлять важные сообщения от имени бота могут только староста ({permanentStarostaMember.name}) и заместитель старосты ({permanentDeputyMember.name}).
                      </p>
                    </div>
                  )}
                </div>

                {/* Right: Feed of Bot Broadcasts sent to all members */}
                <div className="lg:col-span-7 space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                  {botBroadcasts.length === 0 ? (
                    <div
                      className={`p-6 rounded-xl border border-dashed text-center text-xs ${
                        darkMode
                          ? 'border-slate-800 text-slate-500'
                          : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      Важных рассылок от имени бота пока нет. Когда староста или замстаросты отправят сообщение, оно появится здесь и разошлется группе.
                    </div>
                  ) : (
                    botBroadcasts.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-xl border ${
                          darkMode
                            ? 'bg-slate-800/80 border-slate-700'
                            : 'bg-white border-slate-200/90'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2688EB] text-white text-[10px] font-bold">
                              <Bot className="w-3 h-3" /> Бот Староста.ВК
                            </span>
                            {msg.urgent && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                                ВАЖНО
                              </span>
                            )}
                            <span className="font-bold text-xs sm:text-sm">
                              {msg.title}
                            </span>
                          </div>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            ✓ Разослано всем ({msg.deliveredCount}/{members.length} чел.)
                          </span>
                        </div>

                        <p className="text-xs mt-1.5 leading-relaxed">{msg.text}</p>

                        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                          <span>
                            Отправитель: <strong>{msg.senderName}</strong> ({msg.senderRoleLabel})
                          </span>
                          <span>{msg.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Two-column layout: Today's Schedule + Next Week Homework Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left column: Today's classes & homework on each pair */}
              <div
                className={`lg:col-span-7 p-4 rounded-2xl border space-y-3 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/80 shadow-xs'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#2688EB]" />
                      Пары и ДЗ на выбранный день
                    </h2>
                    <p className="text-xs text-slate-500">
                      Добавляйте пары в расписание и прикрепляйте к ним домашние задания
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {DAYS.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDay(d.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          selectedDay === d.id
                            ? 'bg-[#2688EB] text-white'
                            : darkMode
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {d.short}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {schedule.filter(
                    (s) =>
                      s.weekType === currentAcademicWeekType &&
                      s.day === selectedDay
                  ).length === 0 ? (
                    <div
                      className={`p-6 rounded-xl border border-dashed text-center space-y-2 ${
                        darkMode
                          ? 'border-slate-800 text-slate-400'
                          : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <div className="text-xs">
                        На {DAYS.find((d) => d.id === selectedDay)?.full} (
                        {currentAcademicWeekType === 'numerator'
                          ? 'Числитель'
                          : 'Знаменатель'}
                        ) пары еще не добавлены.
                      </div>
                      {effectivePermissions.canEditSchedule && (
                        <button
                          onClick={() =>
                            setPairModal({
                              ...pairModal,
                              open: true,
                              weekType: currentAcademicWeekType,
                              day: selectedDay,
                            })
                          }
                          className="px-3.5 py-1.5 rounded-xl bg-[#2688EB] text-white text-xs font-semibold hover:bg-blue-600 inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Добавить пару на этот день
                        </button>
                      )}
                    </div>
                  ) : (
                    schedule
                      .filter(
                        (s) =>
                          s.weekType === currentAcademicWeekType &&
                          s.day === selectedDay
                      )
                      .sort((a, b) => a.pairNumber - b.pairNumber)
                      .map((pair) => {
                        const pairHws = getHomeworksForPair(pair.id);
                        return (
                          <div
                            key={pair.id}
                            className={`p-3.5 rounded-xl border transition ${
                              darkMode
                                ? 'bg-slate-800/60 border-slate-700'
                                : 'bg-slate-50/80 border-slate-200'
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#2688EB]/15 text-[#2688EB]">
                                    {pair.pairNumber} пара • {pair.time}
                                  </span>
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-500/10">
                                    {pair.type}
                                  </span>
                                  {pair.subgroup > 0 && (
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400">
                                      {pair.subgroup} подгруппа
                                    </span>
                                  )}
                                </div>
                                <h3 className="font-bold text-sm sm:text-base mt-1">
                                  {pair.subject}
                                </h3>
                                <p className="text-xs text-slate-500">
                                  {pair.room} • {pair.teacher}
                                </p>
                              </div>

                              {effectivePermissions.canManageHomework && (
                                <button
                                  onClick={() =>
                                    openAddHomeworkModal(pair, 'current')
                                  }
                                  className="text-xs px-2.5 py-1.5 rounded-lg bg-[#2688EB] text-white hover:bg-blue-600 font-medium flex items-center gap-1 shadow-xs"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Внести ДЗ
                                </button>
                              )}
                            </div>

                            {/* Attached Homeworks to this pair */}
                            <div className="mt-3 space-y-2">
                              {pairHws.length === 0 ? (
                                <div className="text-xs text-slate-400 italic">
                                  Домашнее задание на эту пару пока не внесено
                                </div>
                              ) : (
                                pairHws.map((hw) => {
                                  const isDone = hw.completedBy.includes(
                                    currentUser.id
                                  );
                                  return (
                                    <div
                                      key={hw.id}
                                      className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 ${
                                        darkMode
                                          ? 'bg-slate-900 border-slate-700'
                                          : 'bg-white border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2.5">
                                        <button
                                          onClick={() =>
                                            toggleHomeworkCompleted(hw.id)
                                          }
                                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border transition ${
                                            isDone
                                              ? 'bg-emerald-500 border-emerald-500 text-white'
                                              : 'border-slate-400'
                                          }`}
                                        >
                                          {isDone && <Check className="w-3 h-3" />}
                                        </button>
                                        <div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span
                                              className={`text-xs font-semibold ${
                                                isDone
                                                  ? 'line-through text-slate-400'
                                                  : ''
                                              }`}
                                            >
                                              {hw.title}
                                            </span>
                                            <span
                                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                                hw.targetWeekScope === 'next'
                                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                              }`}
                                            >
                                              {hw.targetWeekScope === 'next'
                                                ? 'На след. неделю'
                                                : 'На эту неделю'}
                                            </span>
                                          </div>
                                          {hw.description && (
                                            <p className="text-xs text-slate-500 mt-0.5">
                                              {hw.description}
                                            </p>
                                          )}
                                          <div className="text-[11px] text-slate-400 mt-1">
                                            Добавил(а): {hw.authorName} •{' '}
                                            {hw.updatedAt}
                                          </div>
                                        </div>
                                      </div>

                                      {effectivePermissions.canManageHomework && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() =>
                                              openEditHomeworkModal(hw)
                                            }
                                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
                                            title="Изменить ДЗ"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => deleteHomework(hw.id)}
                                            className="p-1 rounded hover:bg-rose-500/15 text-rose-500"
                                            title="Удалить ДЗ"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Right column: Next week overview widget */}
              <div
                className={`lg:col-span-5 p-4 rounded-2xl border space-y-3 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-base flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-500" />
                      Что делать на следующую неделю
                    </h2>
                    <p className="text-xs text-slate-500">
                      Следующая неделя —{' '}
                      <strong>
                        {nextAcademicWeekType === 'numerator'
                          ? 'Числитель'
                          : 'Знаменатель'}
                      </strong>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setHwTabScope('next');
                      setActiveTab('homework');
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold hover:bg-amber-500/25"
                  >
                    Все ДЗ
                  </button>
                </div>

                {homeworks.filter((h) => h.targetWeekScope === 'next').length ===
                0 ? (
                  <div
                    className={`p-6 rounded-xl border border-dashed text-center text-xs space-y-2 ${
                      darkMode
                        ? 'border-slate-800 text-slate-400'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    <div>Заданий на следующую неделю пока не добавлено.</div>
                    {effectivePermissions.canManageHomework &&
                      schedule.length > 0 && (
                        <button
                          onClick={() =>
                            openAddHomeworkModal(schedule[0], 'next')
                          }
                          className="text-[#2688EB] font-bold hover:underline"
                        >
                          + Внести ДЗ на следующую неделю
                        </button>
                      )}
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1">
                    {nextWeekHomeworksGrouped.map(
                      ({ day, pairsWithHw, totalHwsOnDay }) => {
                        if (totalHwsOnDay === 0) return null;
                        return (
                          <div
                            key={day.id}
                            className={`p-3 rounded-xl border ${
                              darkMode
                                ? 'bg-slate-800/50 border-slate-700'
                                : 'bg-amber-50/40 border-amber-200/70'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                {day.full}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Заданий: {totalHwsOnDay}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {pairsWithHw.map(({ pair, pairHws }) =>
                                pairHws.map((hw) => {
                                  const isDone = hw.completedBy.includes(
                                    currentUser.id
                                  );
                                  return (
                                    <div
                                      key={hw.id}
                                      className={`p-2 rounded-lg border text-xs ${
                                        darkMode
                                          ? 'bg-slate-900 border-slate-700'
                                          : 'bg-white border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1 text-[11px] text-[#2688EB] font-semibold">
                                        <span>
                                          {pair.pairNumber} пара ({pair.time}) •{' '}
                                          {pair.subject}
                                        </span>
                                        {effectivePermissions.canManageHomework && (
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() =>
                                                openEditHomeworkModal(hw)
                                              }
                                              className="text-slate-400 hover:text-[#2688EB]"
                                            >
                                              <Edit3 className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() =>
                                                deleteHomework(hw.id)
                                              }
                                              className="text-slate-400 hover:text-rose-500"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      <div className="mt-1 flex items-start gap-2">
                                        <button
                                          onClick={() =>
                                            toggleHomeworkCompleted(hw.id)
                                          }
                                          className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                                            isDone
                                              ? 'bg-emerald-500 border-emerald-500 text-white'
                                              : 'border-slate-400'
                                          }`}
                                        >
                                          {isDone && (
                                            <Check className="w-2.5 h-2.5" />
                                          )}
                                        </button>
                                        <div>
                                          <div
                                            className={`font-semibold ${
                                              isDone
                                                ? 'line-through text-slate-400'
                                                : ''
                                            }`}
                                          >
                                            {hw.title}
                                          </div>
                                          {hw.description && (
                                            <div className="text-slate-500 mt-0.5">
                                              {hw.description}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: SCHEDULE & HOMEWORK PER PAIR ==================== */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            {/* Schedule Controls Bar */}
            <div
              className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/80 shadow-xs'
              }`}
            >
              {/* Numerator / Denominator switcher */}
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className={`p-1 rounded-xl flex items-center ${
                    darkMode ? 'bg-slate-800' : 'bg-slate-100'
                  }`}
                >
                  <button
                    onClick={() => setActiveWeekType('numerator')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                      activeWeekType === 'numerator'
                        ? 'bg-[#2688EB] text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Числитель (I){' '}
                    {currentAcademicWeekType === 'numerator'
                      ? '• Текущая'
                      : '• След. неделя'}
                  </button>
                  <button
                    onClick={() => setActiveWeekType('denominator')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                      activeWeekType === 'denominator'
                        ? 'bg-[#2688EB] text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Знаменатель (II){' '}
                    {currentAcademicWeekType === 'denominator'
                      ? '• Текущая'
                      : '• След. неделя'}
                  </button>
                </div>

                {/* Subgroup Filter */}
                <div className="flex items-center gap-1 text-xs">
                  {[
                    { id: 0, label: 'Все подгруппы' },
                    { id: 1, label: '1 подгруппа' },
                    { id: 2, label: '2 подгруппа' },
                  ].map((sg) => (
                    <button
                      key={sg.id}
                      onClick={() => setSelectedSubgroup(sg.id)}
                      className={`px-2.5 py-1.5 rounded-lg font-medium border transition ${
                        selectedSubgroup === sg.id
                          ? 'border-[#2688EB] bg-[#2688EB]/10 text-[#2688EB]'
                          : darkMode
                          ? 'border-slate-700 text-slate-400'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {sg.label}
                    </button>
                  ))}
                </div>
              </div>

              {effectivePermissions.canEditSchedule && (
                <button
                  onClick={() =>
                    setPairModal({
                      ...pairModal,
                      open: true,
                      weekType: activeWeekType,
                      day: selectedDay,
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#2688EB] text-white text-xs sm:text-sm font-semibold hover:bg-blue-600 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Добавить пару
                </button>
              )}
            </div>

            {/* Day selector pills */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DAYS.map((d) => {
                const countPairs = schedule.filter(
                  (s) => s.weekType === activeWeekType && s.day === d.id
                ).length;
                const active = selectedDay === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDay(d.id)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      active
                        ? 'bg-[#2688EB] text-white border-[#2688EB] shadow-sm'
                        : darkMode
                        ? 'bg-slate-900 border-slate-800 hover:bg-slate-800'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{d.short}</span>
                      <span
                        className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-500/10 text-slate-500'
                        }`}
                      >
                        {countPairs} пар
                      </span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 truncate ${
                        active ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {d.full}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pairs List with inline Homework Management */}
            <div className="space-y-3">
              {filteredSchedule.length === 0 ? (
                <div
                  className={`p-8 rounded-2xl border text-center space-y-3 ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800 text-slate-400'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <div className="text-sm font-medium">
                    На {DAYS.find((d) => d.id === selectedDay)?.full} (
                    {activeWeekType === 'numerator'
                      ? 'Числитель'
                      : 'Знаменатель'}
                    ) пары еще не добавлены.
                  </div>
                  {effectivePermissions.canEditSchedule && (
                    <button
                      onClick={() =>
                        setPairModal({
                          ...pairModal,
                          open: true,
                          weekType: activeWeekType,
                          day: selectedDay,
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-[#2688EB] text-white text-xs font-bold hover:bg-blue-600 inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Добавить пару на этот день
                    </button>
                  )}
                </div>
              ) : (
                filteredSchedule.map((pair) => {
                  const pairHws = getHomeworksForPair(pair.id);
                  return (
                    <div
                      key={pair.id}
                      className={`p-4 rounded-2xl border transition ${
                        darkMode
                          ? 'bg-slate-900 border-slate-800'
                          : 'bg-white border-slate-200/90 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-[#2688EB] text-white">
                              {pair.pairNumber} пара • {pair.time}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg ${
                                pair.type === 'Лекция'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : pair.type === 'Лабораторная'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                  : 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                              }`}
                            >
                              {pair.type}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-lg bg-slate-500/10 text-slate-500">
                              {pair.subgroup === 0
                                ? 'Вся группа'
                                : `${pair.subgroup}-я подгруппа`}
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-bold mt-1.5">
                            {pair.subject}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-500">
                            {pair.room} • {pair.teacher}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {effectivePermissions.canManageHomework ? (
                            <button
                              onClick={() =>
                                openAddHomeworkModal(
                                  pair,
                                  activeWeekType === nextAcademicWeekType
                                    ? 'next'
                                    : 'current'
                                )
                              }
                              className="px-3 py-1.5 rounded-xl bg-[#2688EB] text-white text-xs font-semibold hover:bg-blue-600 flex items-center gap-1.5 shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5" /> Внести ДЗ на пару
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" /> Нет прав редактирования ДЗ
                            </span>
                          )}
                          {effectivePermissions.canEditSchedule && (
                            <button
                              onClick={() => deleteSchedulePair(pair.id)}
                              className="p-1.5 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                              title="Удалить пару"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Homework Box inside every schedule card */}
                      <div
                        className={`mt-3 pt-3 border-t ${
                          darkMode ? 'border-slate-800' : 'border-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-[#2688EB]" />
                            Домашние задания к этой паре ({pairHws.length})
                          </span>
                        </div>

                        {pairHws.length === 0 ? (
                          <div
                            className={`p-3 rounded-xl border border-dashed text-xs flex items-center justify-between ${
                              darkMode
                                ? 'border-slate-800 text-slate-500'
                                : 'border-slate-200 text-slate-400'
                            }`}
                          >
                            <span>На эту пару домашнее задание еще не добавлено.</span>
                            {effectivePermissions.canManageHomework && (
                              <button
                                onClick={() =>
                                  openAddHomeworkModal(
                                    pair,
                                    activeWeekType === nextAcademicWeekType
                                      ? 'next'
                                      : 'current'
                                  )
                                }
                                className="text-[#2688EB] font-semibold hover:underline"
                              >
                                + Добавить первым
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pairHws.map((hw) => {
                              const isDone = hw.completedBy.includes(currentUser.id);
                              return (
                                <div
                                  key={hw.id}
                                  className={`p-3 rounded-xl border flex flex-wrap sm:flex-nowrap items-start justify-between gap-3 ${
                                    darkMode
                                      ? 'bg-slate-800/70 border-slate-700'
                                      : 'bg-slate-50 border-slate-200/80'
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <button
                                      onClick={() => toggleHomeworkCompleted(hw.id)}
                                      className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 transition ${
                                        isDone
                                          ? 'bg-emerald-500 border-emerald-500 text-white'
                                          : 'border-slate-400'
                                      }`}
                                    >
                                      {isDone && <Check className="w-3 h-3" />}
                                    </button>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                          className={`font-bold text-sm ${
                                            isDone ? 'line-through text-slate-400' : ''
                                          }`}
                                        >
                                          {hw.title}
                                        </span>
                                        <span
                                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                            hw.targetWeekScope === 'next'
                                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                          }`}
                                        >
                                          {hw.targetWeekScope === 'next'
                                            ? 'На следующую неделю'
                                            : 'На текущую неделю'}
                                        </span>
                                        {hw.priority === 'high' && (
                                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold">
                                            Важно
                                          </span>
                                        )}
                                      </div>
                                      {hw.description && (
                                        <p className="text-xs text-slate-500 mt-1">
                                          {hw.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[11px] text-slate-400">
                                        <span>Автор: {hw.authorName}</span>
                                        <span>•</span>
                                        <span>{hw.updatedAt}</span>
                                        {hw.attachment && (
                                          <>
                                            <span>•</span>
                                            <span className="text-[#2688EB] flex items-center gap-1 font-medium">
                                              <LinkIcon className="w-3 h-3" /> Материалы:{' '}
                                              {hw.attachment}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {effectivePermissions.canManageHomework && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        onClick={() => openEditHomeworkModal(hw)}
                                        className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 ${
                                          darkMode
                                            ? 'border-slate-700 hover:bg-slate-700 text-slate-200'
                                            : 'border-slate-200 hover:bg-white text-slate-700'
                                        }`}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" /> Изменить
                                      </button>
                                      <button
                                        onClick={() => deleteHomework(hw.id)}
                                        className="px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-1 hover:bg-rose-500/20"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> Удалить
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: NEXT WEEK HOMEWORK OVERVIEW ==================== */}
        {activeTab === 'homework' && (
          <div className="space-y-4">
            {/* Header & Scope Filter */}
            <div
              className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/80 shadow-xs'
              }`}
            >
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#2688EB]" />
                  План домашних заданий по неделям и парам
                </h2>
                <p className="text-xs text-slate-500">
                  Смотрите все задания на следующую неделю (
                  {nextAcademicWeekType === 'numerator'
                    ? 'Числитель'
                    : 'Знаменатель'}
                  ) или текущую неделю
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className={`p-1 rounded-xl flex items-center ${
                    darkMode ? 'bg-slate-800' : 'bg-slate-100'
                  }`}
                >
                  {[
                    { id: 'next', label: 'На следующую неделю' },
                    { id: 'current', label: 'На текущую неделю' },
                    { id: 'all', label: 'Все ДЗ' },
                  ].map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => setHwTabScope(sc.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        hwTabScope === sc.id
                          ? 'bg-[#2688EB] text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>

                {effectivePermissions.canManageHomework && (
                  <button
                    onClick={() => {
                      const defaultPair =
                        schedule.find(
                          (s) =>
                            s.weekType ===
                            (hwTabScope === 'next'
                              ? nextAcademicWeekType
                              : currentAcademicWeekType)
                        ) || schedule[0];
                      openAddHomeworkModal(
                        defaultPair,
                        hwTabScope === 'current' ? 'current' : 'next'
                      );
                    }}
                    className="px-3 py-2 rounded-xl bg-[#2688EB] text-white text-xs font-semibold hover:bg-blue-600 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Добавить ДЗ
                  </button>
                )}
              </div>
            </div>

            {/* Search & Done Filter */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border flex-1 min-w-[220px] ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={hwSearchQuery}
                  onChange={(e) => setHwSearchQuery(e.target.value)}
                  placeholder="Поиск по предмету или тексту задания..."
                  className="bg-transparent text-xs sm:text-sm w-full focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'pending', label: 'Не выполнено' },
                  { id: 'done', label: 'Выполнено мной' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setHwFilterStatus(st.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                      hwFilterStatus === st.id
                        ? 'border-[#2688EB] bg-[#2688EB]/10 text-[#2688EB]'
                        : darkMode
                        ? 'bg-slate-900 border-slate-800 text-slate-400'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Day-by-Day Breakdown for Selected Week Scope */}
            {schedule.length === 0 ? (
              <div
                className={`p-8 rounded-2xl border text-center space-y-3 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800 text-slate-400'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                <div className="text-sm font-medium">
                  Расписание группы пока пустое. Сначала добавьте пары в расписание, чтобы привязывать к ним домашние задания.
                </div>
                {effectivePermissions.canEditSchedule && (
                  <button
                    onClick={() => setPairModal({ ...pairModal, open: true })}
                    className="px-4 py-2 rounded-xl bg-[#2688EB] text-white text-xs font-bold hover:bg-blue-600 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Добавить первую пару
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {DAYS.map((day) => {
                  const relevantPairs = schedule
                    .filter((p) => {
                      if (p.day !== day.id) return false;
                      if (hwTabScope === 'next')
                        return p.weekType === nextAcademicWeekType;
                      if (hwTabScope === 'current')
                        return p.weekType === currentAcademicWeekType;
                      return true;
                    })
                    .sort((a, b) => a.pairNumber - b.pairNumber);

                  if (relevantPairs.length === 0) return null;

                  return (
                    <div
                      key={day.id}
                      className={`p-4 rounded-2xl border ${
                        darkMode
                          ? 'bg-slate-900 border-slate-800'
                          : 'bg-white border-slate-200/90 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-[#2688EB]/10 text-[#2688EB] font-bold text-xs">
                            {day.full}
                          </span>
                          <span className="text-xs text-slate-400">
                            {hwTabScope === 'next'
                              ? 'Следующая неделя'
                              : hwTabScope === 'current'
                              ? 'Текущая неделя'
                              : 'Все недели'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {relevantPairs.map((pair) => {
                          const pairHws = homeworks.filter((hw) => {
                            if (hw.scheduleId !== pair.id) return false;
                            if (
                              hwTabScope !== 'all' &&
                              hw.targetWeekScope !== hwTabScope
                            )
                              return false;
                            const isDone = hw.completedBy.includes(
                              currentUser.id
                            );
                            if (hwFilterStatus === 'pending' && isDone)
                              return false;
                            if (hwFilterStatus === 'done' && !isDone)
                              return false;
                            if (hwSearchQuery.trim()) {
                              const q = hwSearchQuery.toLowerCase();
                              const matchSubject = pair.subject
                                .toLowerCase()
                                .includes(q);
                              const matchTitle = hw.title
                                .toLowerCase()
                                .includes(q);
                              const matchDesc = hw.description
                                .toLowerCase()
                                .includes(q);
                              if (!matchSubject && !matchTitle && !matchDesc)
                                return false;
                            }
                            return true;
                          });

                          return (
                            <div
                              key={pair.id}
                              className={`p-3 rounded-xl border ${
                                darkMode
                                  ? 'bg-slate-800/40 border-slate-800'
                                  : 'bg-slate-50/70 border-slate-200/70'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-[#2688EB]">
                                    {pair.pairNumber} пара ({pair.time})
                                  </span>
                                  <span className="font-bold text-sm">
                                    {pair.subject}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-500/10 text-slate-500">
                                    {pair.type}
                                  </span>
                                </div>

                                {effectivePermissions.canManageHomework && (
                                  <button
                                    onClick={() =>
                                      openAddHomeworkModal(
                                        pair,
                                        hwTabScope === 'current'
                                          ? 'current'
                                          : 'next'
                                      )
                                    }
                                    className="text-xs text-[#2688EB] hover:underline font-semibold flex items-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Добавить ДЗ на пару
                                  </button>
                                )}
                              </div>

                              {pairHws.length === 0 ? (
                                <div className="text-xs text-slate-400 mt-1.5">
                                  Нет заданий по текущему фильтру
                                </div>
                              ) : (
                                <div className="mt-2 space-y-2">
                                  {pairHws.map((hw) => {
                                    const isDone = hw.completedBy.includes(
                                      currentUser.id
                                    );
                                    return (
                                      <div
                                        key={hw.id}
                                        className={`p-2.5 rounded-lg border flex flex-wrap sm:flex-nowrap items-start justify-between gap-2 ${
                                          darkMode
                                            ? 'bg-slate-900 border-slate-700'
                                            : 'bg-white border-slate-200'
                                        }`}
                                      >
                                        <div className="flex items-start gap-2.5">
                                          <button
                                            onClick={() =>
                                              toggleHomeworkCompleted(hw.id)
                                            }
                                            className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                              isDone
                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                : 'border-slate-400'
                                            }`}
                                          >
                                            {isDone && (
                                              <Check className="w-3 h-3" />
                                            )}
                                          </button>
                                          <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span
                                                className={`text-xs sm:text-sm font-bold ${
                                                  isDone
                                                    ? 'line-through text-slate-400'
                                                    : ''
                                                }`}
                                              >
                                                {hw.title}
                                              </span>
                                              <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                                  hw.targetWeekScope === 'next'
                                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                    : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                                }`}
                                              >
                                                {hw.targetWeekScope === 'next'
                                                  ? 'След. неделя'
                                                  : 'Текущая неделя'}
                                              </span>
                                            </div>
                                            {hw.description && (
                                              <p className="text-xs text-slate-500 mt-0.5">
                                                {hw.description}
                                              </p>
                                            )}
                                            <div className="text-[11px] text-slate-400 mt-1">
                                              Внес(ла): {hw.authorName} • Выполнено у{' '}
                                              {hw.completedBy.length} из{' '}
                                              {members.length} чел.
                                            </div>
                                          </div>
                                        </div>

                                        {effectivePermissions.canManageHomework && (
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              onClick={() =>
                                                openEditHomeworkModal(hw)
                                              }
                                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                                              title="Редактировать ДЗ"
                                            >
                                              <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() =>
                                                deleteHomework(hw.id)
                                              }
                                              className="p-1.5 rounded-lg hover:bg-rose-500/15 text-rose-500"
                                              title="Удалить ДЗ"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: ROLES, DEPUTIES & HOMEWORK PERMISSIONS PANEL ==================== */}
        {activeTab === 'roles' && (
          <div className="space-y-4">
            {/* SPECIAL DEDICATED PANEL: WHO CAN ADD / EDIT / DELETE HOMEWORK */}
            <div
              className={`p-4 sm:p-5 rounded-2xl border-2 border-[#2688EB]/40 ${
                darkMode
                  ? 'bg-slate-900'
                  : 'bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/40 shadow-xs'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2688EB] text-white text-[11px] font-bold mb-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> СПЕЦИАЛЬНАЯ ПЛАШКА ДОСТУПА К ДЗ
                  </div>
                  <h2 className="text-base sm:text-lg font-bold">
                    Кто может добавлять, изменять и удалять домашние задания
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Отметьте участников группы, которым разрешено вносить ДЗ на пары, править описания и удалять задания.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!effectivePermissions.canManageRoles) {
                        showToast('Только староста или зам может менять права');
                        return;
                      }
                      setMembers((prev) =>
                        prev.map((m) => ({
                          ...m,
                          permissions: {
                            ...m.permissions,
                            canManageHomework: true,
                          },
                        }))
                      );
                      showToast('Право управления ДЗ выдано всей группе');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-[#2688EB]/10 text-[#2688EB] hover:bg-[#2688EB]/20 text-xs font-semibold"
                  >
                    Разрешить всем
                  </button>
                  <button
                    onClick={() => {
                      if (!effectivePermissions.canManageRoles) {
                        showToast('Только староста или зам может менять права');
                        return;
                      }
                      setMembers((prev) =>
                        prev.map((m) =>
                          m.role === 'starosta' || m.role === 'deputy'
                            ? m
                            : {
                                ...m,
                                permissions: {
                                  ...m.permissions,
                                  canManageHomework: false,
                                },
                              }
                        )
                      );
                      showToast(
                        'Право управления ДЗ оставлено только старосте и замам'
                      );
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 hover:bg-slate-500/20 text-xs font-semibold"
                  >
                    Только староста и замы
                  </button>
                </div>
              </div>

              {/* Member cards inside the dedicated Homework Access Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {members.map((m) => {
                  const isDailyDep = dailyDeputyByDay[selectedDay] === m.id;
                  const hasHwAccess =
                    m.role === 'starosta' ||
                    m.permissions?.canManageHomework ||
                    (isDailyDep && dailyDeputyPermissions.canManageHomework);

                  return (
                    <div
                      key={m.id}
                      onClick={() =>
                        toggleMemberPermission(m.id, 'canManageHomework')
                      }
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                        hasHwAccess
                          ? darkMode
                            ? 'bg-blue-950/40 border-[#2688EB]'
                            : 'bg-white border-[#2688EB] shadow-xs'
                          : darkMode
                          ? 'bg-slate-800/40 border-slate-800 opacity-75'
                          : 'bg-white/60 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 ${m.avatarColor}`}
                        >
                          {m.name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">
                            {m.name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {m.role === 'starosta'
                              ? 'Староста (неизменно)'
                              : m.role === 'deputy'
                              ? 'Замстаросты (неизменно)'
                              : isDailyDep
                              ? 'Назначен на день'
                              : hasHwAccess
                              ? 'Редактор ДЗ'
                              : 'Только просмотр ДЗ'}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-9 h-5 rounded-full p-0.5 transition shrink-0 ${
                          hasHwAccess
                            ? 'bg-[#2688EB]'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            hasHwAccess ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* REQUIREMENT 4B: FIXED PERMANENT ROLES vs DAILY REPLACEMENT APPOINTED BY STAROSTA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fixed Permanent Leaders */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/90 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-500" />
                    Постоянный руководящий состав группы
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400">
                    Не изменяется
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Должности старосты и заместителя старосты закреплены за группой постоянно. Им обоим доступна рассылка важных сообщений от имени бота.
                </p>

                <div className="space-y-2 pt-1">
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      darkMode
                        ? 'bg-slate-800/60 border-slate-700'
                        : 'bg-blue-50/50 border-blue-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-full text-white font-bold flex items-center justify-center ${permanentStarostaMember.avatarColor}`}
                      >
                        {permanentStarostaMember.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm">
                          {permanentStarostaMember.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {permanentStarostaMember.vkTag} • Выбирает замену на день
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-[#2688EB] text-white text-xs font-bold">
                      Староста
                    </span>
                  </div>

                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      darkMode
                        ? 'bg-slate-800/60 border-slate-700'
                        : 'bg-purple-50/50 border-purple-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-full text-white font-bold flex items-center justify-center ${permanentDeputyMember.avatarColor}`}
                      >
                        {permanentDeputyMember.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm">
                          {permanentDeputyMember.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {permanentDeputyMember.vkTag} • Постоянный заместитель
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-bold">
                      Замстаросты
                    </span>
                  </div>
                </div>
              </div>

              {/* Daily Replacement Appointed by Starosta */}
              <div
                className={`p-4 rounded-2xl border space-y-2.5 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/90 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Назначение человека на день (выбирает Староста)
                  </h3>
                  <button
                    onClick={() => pickRandomDailyDeputy(selectedDay)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> Рандом
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Если староста или её заместитель отсутствуют, староста назначает ответственного на день. Плашка отсутствия появляется на экране <strong>только если кто-то назначен</strong>.
                </p>

                <div className="grid grid-cols-6 gap-1">
                  {DAYS.map((d) => {
                    const hasAssigned = Boolean(dailyDeputyByDay[d.id]);
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDay(d.id)}
                        className={`py-1.5 rounded-lg text-xs font-bold relative ${
                          selectedDay === d.id
                            ? 'bg-[#2688EB] text-white'
                            : darkMode
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {d.short}
                        {hasAssigned && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 right-1" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2 pt-1 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">
                      Кто назначен на {DAYS.find((d) => d.id === selectedDay)?.full}:
                    </label>
                    <select
                      value={dailyDeputyByDay[selectedDay] || ''}
                      onChange={(e) =>
                        appointDailyDeputy(selectedDay, e.target.value || null)
                      }
                      disabled={currentUser.role !== 'starosta'}
                      className={`w-full px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold ${
                        darkMode
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <option value="">
                        — Никто не назначен (плашка на экране скрыта) —
                      </option>
                      {members
                        .filter(
                          (m) => m.role !== 'starosta' && m.role !== 'deputy'
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.subgroup} подгруппа)
                          </option>
                        ))}
                    </select>
                  </div>

                  {dailyDeputyByDay[selectedDay] && (
                    <div>
                      <label className="block font-semibold mb-1">
                        Причина назначения (отображается на плашке):
                      </label>
                      <select
                        value={
                          dailyAbsenceReasonByDay[selectedDay] || 'both_absent'
                        }
                        onChange={(e) =>
                          setDailyAbsenceReasonByDay((prev) => ({
                            ...prev,
                            [selectedDay]: e.target.value,
                          }))
                        }
                        disabled={currentUser.role !== 'starosta'}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${
                          darkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      >
                        <option value="both_absent">
                          Староста и заместитель старосты отсутствуют
                        </option>
                        <option value="starosta_absent">
                          Староста отсутствует
                        </option>
                        <option value="deputy_absent">
                          Заместитель старосты отсутствует
                        </option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dailyDeputyPermissions.canManageHomework}
                      onChange={(e) =>
                        setDailyDeputyPermissions((prev) => ({
                          ...prev,
                          canManageHomework: e.target.checked,
                        }))
                      }
                      className="rounded text-[#2688EB]"
                    />
                    <span>Разрешать назначенному менять/добавлять ДЗ</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dailyDeputyPermissions.canMarkAttendance}
                      onChange={(e) =>
                        setDailyDeputyPermissions((prev) => ({
                          ...prev,
                          canMarkAttendance: e.target.checked,
                        }))
                      }
                      className="rounded text-[#2688EB]"
                    />
                    <span>Отмечать посещаемость</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Full Granular Permissions Matrix Table */}
            <div
              className={`p-4 rounded-2xl border overflow-hidden ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/90 shadow-xs'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Матрица индивидуального доступа для каждого участника
                  </h3>
                  <p className="text-xs text-slate-500">
                    Добавляйте студентов вручную или отправьте им код группы ({groupInfo?.code}) для самостоятельного входа
                  </p>
                </div>
                <button
                  onClick={() =>
                    setNewMemberModal({ ...newMemberModal, open: true })
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#2688EB] text-white text-xs font-semibold hover:bg-blue-600 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Добавить студента
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr
                      className={`border-b text-[11px] uppercase tracking-wider ${
                        darkMode
                          ? 'border-slate-800 text-slate-400'
                          : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <th className="py-2.5 px-2">Участник группы</th>
                      <th className="py-2.5 px-2">Роль</th>
                      <th className="py-2.5 px-2 text-center bg-[#2688EB]/5 text-[#2688EB] font-bold">
                        Управление ДЗ (добавл./изм./удал.)
                      </th>
                      <th className="py-2.5 px-2 text-center">Журнал явки</th>
                      <th className="py-2.5 px-2 text-center">Расписание</th>
                      <th className="py-2.5 px-2 text-center">Очереди на лабы</th>
                      <th className="py-2.5 px-2 text-center">Объявления</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {members.map((m) => {
                      const isStarosta = m.role === 'starosta';
                      return (
                        <tr key={m.id}>
                          <td className="py-2.5 px-2 font-semibold flex items-center gap-2">
                            <span
                              className={`w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${m.avatarColor}`}
                            >
                              {m.name[0]}
                            </span>
                            <div>
                              <div>{m.name}</div>
                              <div className="text-[11px] text-slate-400 font-normal">
                                {m.vkTag} • {m.subgroup} подгр.
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                m.role === 'starosta'
                                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                  : m.role === 'deputy'
                                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                                  : dailyDeputyByDay[selectedDay] === m.id
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                  : 'bg-slate-500/10 text-slate-500'
                              }`}
                            >
                              {m.role === 'starosta'
                                ? 'Староста (пост.)'
                                : m.role === 'deputy'
                                ? 'Замстаросты (пост.)'
                                : dailyDeputyByDay[selectedDay] === m.id
                                ? 'Назначен на день'
                                : 'Участник'}
                            </span>
                          </td>
                          {[
                            'canManageHomework',
                            'canMarkAttendance',
                            'canEditSchedule',
                            'canManageQueues',
                            'canPostAnnouncements',
                          ].map((permKey) => {
                            const checked =
                              isStarosta || Boolean(m.permissions?.[permKey]);
                            return (
                              <td
                                key={permKey}
                                className={`py-2.5 px-2 text-center ${
                                  permKey === 'canManageHomework'
                                    ? 'bg-[#2688EB]/5'
                                    : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isStarosta}
                                  checked={checked}
                                  onChange={() =>
                                    toggleMemberPermission(m.id, permKey)
                                  }
                                  className="w-4 h-4 rounded text-[#2688EB] cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: ATTENDANCE JOURNAL ==================== */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/90 shadow-xs'
              }`}
            >
              <div>
                <h2 className="font-bold text-base sm:text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#2688EB]" />
                  Электронный журнал посещаемости (Рапортичка)
                </h2>
                <p className="text-xs text-slate-500">
                  Отмечайте явку на каждой паре в 1 клик. Доступно старосте, заму и назначенному на день.
                </p>
              </div>

              {schedule.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={attendanceSelectedPairId}
                    onChange={(e) =>
                      setAttendanceSelectedPairId(e.target.value)
                    }
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {schedule.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{s.weekType === 'numerator' ? 'Числитель' : 'Знаменатель'}{' '}
                        • {DAYS.find((d) => d.id === s.day)?.short}]{' '}
                        {s.pairNumber} пара: {s.subject}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => markAllPresent(attendanceSelectedPairId)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                  >
                    Все на месте
                  </button>
                </div>
              )}
            </div>

            {schedule.length === 0 ? (
              <div
                className={`p-8 rounded-2xl border text-center space-y-3 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800 text-slate-400'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                <div className="text-sm font-medium">
                  Чтобы отмечать посещаемость, сначала добавьте пары в расписание.
                </div>
                {effectivePermissions.canEditSchedule && (
                  <button
                    onClick={() => setPairModal({ ...pairModal, open: true })}
                    className="px-4 py-2 rounded-xl bg-[#2688EB] text-white text-xs font-bold"
                  >
                    + Добавить пару
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`p-4 rounded-2xl border ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200/90 shadow-xs'
                }`}
              >
                <div className="space-y-2">
                  {members.map((m) => {
                    const status =
                      attendance[`${attendanceSelectedPairId}_${m.id}`] ||
                      'present';
                    return (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                          darkMode
                            ? 'bg-slate-800/40 border-slate-800'
                            : 'bg-slate-50/70 border-slate-200/70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center ${m.avatarColor}`}
                          >
                            {m.name[0]}
                          </span>
                          <div>
                            <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                              <span>{m.name}</span>
                              {m.role === 'starosta' && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/15 text-[#2688EB]">
                                  Староста
                                </span>
                              )}
                              {m.role === 'deputy' && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-500">
                                  Замстаросты
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {m.subgroup} подгруппа
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {[
                            {
                              id: 'present',
                              label: 'Был',
                              activeClass: 'bg-emerald-600 text-white',
                            },
                            {
                              id: 'late',
                              label: 'Опоздал',
                              activeClass: 'bg-amber-500 text-white',
                            },
                            {
                              id: 'excused',
                              label: 'Уважит.',
                              activeClass: 'bg-blue-600 text-white',
                            },
                            {
                              id: 'absent',
                              label: 'Н (Пропуск)',
                              activeClass: 'bg-rose-600 text-white',
                            },
                          ].map((st) => (
                            <button
                              key={st.id}
                              onClick={() =>
                                setStudentAttendance(
                                  attendanceSelectedPairId,
                                  m.id,
                                  st.id
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                status === st.id
                                  ? st.activeClass
                                  : darkMode
                                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 6: EXTRAS (LAB QUEUES & GROUP FUNDS) ==================== */}
        {activeTab === 'extras' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Electronic Lab Queue */}
            <div
              className={`p-4 rounded-2xl border space-y-3 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/90 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base flex items-center gap-2">
                    <ListOrdered className="w-5 h-5 text-[#2688EB]" />
                    Электронная очередь на сдачу лаб
                  </h2>
                  <p className="text-xs text-slate-500">
                    Запись на защиту лабораторных и курсовых работ
                  </p>
                </div>
                {effectivePermissions.canManageQueues && (
                  <button
                    onClick={() =>
                      setQueueModal({ open: true, subject: '', dateLabel: '' })
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#2688EB] text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Создать очередь
                  </button>
                )}
              </div>

              {queues.length === 0 ? (
                <div
                  className={`p-6 rounded-xl border border-dashed text-center text-xs ${
                    darkMode
                      ? 'border-slate-800 text-slate-400'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Активных очередей на сдачу пока нет.
                </div>
              ) : (
                <div className="space-y-3">
                  {queues.map((q) => {
                    const alreadyInQueue = q.entries.some(
                      (e) => e.userId === currentUser.id
                    );
                    return (
                      <div
                        key={q.id}
                        className={`p-3.5 rounded-xl border ${
                          darkMode
                            ? 'bg-slate-800/50 border-slate-700'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm">{q.subject}</div>
                            <div className="text-xs text-slate-400">
                              {q.dateLabel}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setQueues((prev) =>
                                  prev.map((item) => {
                                    if (item.id !== q.id) return item;
                                    if (alreadyInQueue) {
                                      return {
                                        ...item,
                                        entries: item.entries.filter(
                                          (e) => e.userId !== currentUser.id
                                        ),
                                      };
                                    }
                                    return {
                                      ...item,
                                      entries: [
                                        ...item.entries,
                                        {
                                          userId: currentUser.id,
                                          status: 'waiting',
                                        },
                                      ],
                                    };
                                  })
                                );
                                showToast(
                                  alreadyInQueue
                                    ? 'Вы вышли из очереди'
                                    : 'Вы записались в очередь на сдачу!'
                                );
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                alreadyInQueue
                                  ? 'bg-rose-500/15 text-rose-500'
                                  : 'bg-[#2688EB] text-white'
                              }`}
                            >
                              {alreadyInQueue
                                ? 'Выйти из очереди'
                                : 'Записаться'}
                            </button>

                            {effectivePermissions.canManageQueues && (
                              <button
                                onClick={() => {
                                  setQueues((prev) =>
                                    prev.map((item) => {
                                      if (item.id !== q.id) return item;
                                      const shuffled = [...item.entries].sort(
                                        () => Math.random() - 0.5
                                      );
                                      return { ...item, entries: shuffled };
                                    })
                                  );
                                  showToast(
                                    'Очередь перемешана случайным образом!'
                                  );
                                }}
                                className="p-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                title="Перемешать очередь (Рандом)"
                              >
                                <Shuffle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-2.5 space-y-1.5">
                          {q.entries.length === 0 ? (
                            <div className="text-xs text-slate-400 italic">
                              Пока никто не записался
                            </div>
                          ) : (
                            q.entries.map((entry, idx) => {
                              const st =
                                members.find((m) => m.id === entry.userId) ||
                                currentUser;
                              return (
                                <div
                                  key={entry.userId}
                                  className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs ${
                                    darkMode
                                      ? 'bg-slate-900'
                                      : 'bg-white border border-slate-200/70'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#2688EB]">
                                      #{idx + 1}
                                    </span>
                                    <span
                                      className={
                                        entry.status === 'done'
                                          ? 'line-through text-slate-400'
                                          : 'font-medium'
                                      }
                                    >
                                      {st.name}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[11px] font-semibold ${
                                      entry.status === 'done'
                                        ? 'text-emerald-500'
                                        : 'text-amber-500'
                                    }`}
                                  >
                                    {entry.status === 'done'
                                      ? 'Сдал(а)'
                                      : 'Ожидает'}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Group Funds */}
            <div
              className={`p-4 rounded-2xl border space-y-3 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200/90 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-500" />
                    Сборы в фонд группы
                  </h2>
                  <p className="text-xs text-slate-500">
                    Прозрачный учет взносов на нужды группы
                  </p>
                </div>
                {effectivePermissions.canPostAnnouncements && (
                  <button
                    onClick={() =>
                      setFundModal({
                        open: true,
                        title: '',
                        amountPerPerson: '',
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Открыть сбор
                  </button>
                )}
              </div>

              {funds.length === 0 ? (
                <div
                  className={`p-6 rounded-xl border border-dashed text-center text-xs ${
                    darkMode
                      ? 'border-slate-800 text-slate-400'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Активных сборов в группе пока нет.
                </div>
              ) : (
                <div className="space-y-3">
                  {funds.map((f) => {
                    const isPaid = f.paidIds.includes(currentUser.id);
                    return (
                      <div
                        key={f.id}
                        className={`p-3.5 rounded-xl border ${
                          darkMode
                            ? 'bg-slate-800/50 border-slate-700'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm">{f.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              По <strong>{f.amountPerPerson} ₽</strong> • Сдали:{' '}
                              {f.paidIds.length} из {members.length} чел.
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setFunds((prev) =>
                                prev.map((item) => {
                                  if (item.id !== f.id) return item;
                                  return {
                                    ...item,
                                    paidIds: isPaid
                                      ? item.paidIds.filter(
                                          (id) => id !== currentUser.id
                                        )
                                      : [...item.paidIds, currentUser.id],
                                  };
                                })
                              );
                              showToast(
                                isPaid
                                  ? 'Отметка об оплате снята'
                                  : 'Отмечено: вы сдали взнос!'
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              isPaid
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-[#2688EB] text-white'
                            }`}
                          >
                            {isPaid ? '✓ Оплачено' : 'Отметить оплату'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ==================== MODAL: VK DEPLOY & BOT CONNECTION ==================== */}
      {vkDeployModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-2xl rounded-2xl border p-5 space-y-4 max-h-[90vh] overflow-y-auto ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#2688EB]" />
                Перенос и публикация в ВКонтакте (VK Mini Apps + Бот)
              </h3>
              <button
                onClick={() => setVkDeployModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-blue-50/70 border-blue-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    Все демонстрационные данные удалены. Приложение интегрировано с <strong>@vkontakte/vk-bridge</strong> и сохраняет данные в <strong>VK Storage</strong>.
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  Ваш ID мини-приложения ВК (App ID из dev.vk.com):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={vkAppId}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '') || '51890000';
                      setVkAppId(val);
                      if (groupInfo) {
                        setGroupInfo({
                          ...groupInfo,
                          inviteLink: `https://vk.com/app${val}#join=${groupInfo.code}`,
                        });
                      }
                    }}
                    placeholder="Например: 51890000"
                    className={`flex-1 px-3 py-2 rounded-xl border font-bold ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                  <span className="text-xs text-slate-400">
                    Ссылка: vk.com/app{vkAppId}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold">
                  Пошаговый запуск в ВК за 3 минуты (из готового архива проекта):
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <li>
                    Зайдите на <strong>dev.vk.com</strong> → «Мои приложения» → «Создать» → выберите <strong>Мини-приложение</strong> и скопируйте его <strong>ID приложения</strong>.
                  </li>
                  <li>
                    Скачайте приложенный архив проекта <code>starosta_vk_mini_app.zip</code>, распакуйте и укажите ваш <code>app_id</code> в файле <code>vk-hosting-config.json</code>.
                  </li>
                  <li>
                    Выполните в терминале команды:
                    <pre
                      className={`mt-1 p-2.5 rounded-xl border font-mono text-[11px] ${
                        darkMode
                          ? 'bg-slate-950 border-slate-800 text-emerald-400'
                          : 'bg-slate-900 text-emerald-400'
                      }`}
                    >
                      {`npm install\nnpm run build\nnpx vk-miniapps-deploy`}
                    </pre>
                  </li>
                  <li>
                    Для работы рассылки от имени бота в беседу и ЛС группы запустите сервер бота из папки <code>bot_server/</code>, указав токен вашего сообщества ВК (<code>VK_GROUP_TOKEN</code>).
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={resetAllData}
                className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Сбросить все данные приложения
              </button>
              <button
                onClick={() => setVkDeployModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#2688EB] text-white text-xs font-bold"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: GROUP CODE & INVITE LINK ==================== */}
      {inviteModalOpen && groupInfo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border p-5 space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#2688EB]" />
                Код группы и приглашение для студентов
              </h3>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                darkMode
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-blue-50/60 border-blue-200'
              }`}
            >
              <div>
                <div className="text-xs text-slate-500">
                  Идентификатор группы ({groupInfo.name}):
                </div>
                <div className="text-lg font-black text-[#2688EB]">
                  {groupInfo.code}
                </div>
              </div>
              <button
                onClick={() =>
                  copyTextToClipboard(
                    groupInfo.code,
                    `Код ${groupInfo.code} скопирован!`
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-[#2688EB] text-white text-xs font-bold flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Копировать код
              </button>
            </div>

            <div>
              <div className="text-xs font-semibold mb-1 text-slate-500">
                Текст со ссылкой для отправки в беседу группы ВК:
              </div>
              <pre
                className={`p-3 rounded-xl border text-xs whitespace-pre-wrap font-sans ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                {formattedInviteText}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={shareInviteInVk}
                className="px-4 py-2 rounded-xl bg-[#2688EB] text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" /> Поделиться в ВК / Скопировать
              </button>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-500/10"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD / EDIT HOMEWORK ==================== */}
      {hwModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border p-5 space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">
                {hwModal.mode === 'add'
                  ? 'Внести домашнее задание на пару'
                  : 'Редактировать домашнее задание'}
              </h3>
              <button
                onClick={() => setHwModal({ ...hwModal, open: false })}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold mb-1">
                  На какую неделю задание?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setHwModal({ ...hwModal, targetWeekScope: 'current' })
                    }
                    className={`py-2 px-3 rounded-xl border font-semibold text-xs ${
                      hwModal.targetWeekScope === 'current'
                        ? 'border-[#2688EB] bg-[#2688EB]/15 text-[#2688EB]'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    На текущую неделю (
                    {currentAcademicWeekType === 'numerator'
                      ? 'Числитель'
                      : 'Знаменатель'}
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHwModal({ ...hwModal, targetWeekScope: 'next' })
                    }
                    className={`py-2 px-3 rounded-xl border font-semibold text-xs ${
                      hwModal.targetWeekScope === 'next'
                        ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    На следующую неделю (
                    {nextAcademicWeekType === 'numerator'
                      ? 'Числитель'
                      : 'Знаменатель'}
                    )
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Выберите пару:</label>
                <select
                  value={hwModal.scheduleId}
                  onChange={(e) =>
                    setHwModal({ ...hwModal, scheduleId: e.target.value })
                  }
                  className={`w-full px-3 py-2 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {schedule.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.weekType === 'numerator' ? 'Числитель' : 'Знаменатель'} •{' '}
                      {DAYS.find((d) => d.id === s.day)?.short}] {s.pairNumber} пара —{' '}
                      {s.subject} ({s.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Краткая суть задания:
                </label>
                <input
                  type="text"
                  value={hwModal.title}
                  onChange={(e) =>
                    setHwModal({ ...hwModal, title: e.target.value })
                  }
                  placeholder="Что задали на эту пару?"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Подробности / комментарии преподавателя:
                </label>
                <textarea
                  rows={3}
                  value={hwModal.description}
                  onChange={(e) =>
                    setHwModal({ ...hwModal, description: e.target.value })
                  }
                  placeholder="Требования к оформлению, номера задач..."
                  className={`w-full px-3 py-2 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">
                    Ссылка на материалы / методичку:
                  </label>
                  <input
                    type="text"
                    value={hwModal.attachment}
                    onChange={(e) =>
                      setHwModal({ ...hwModal, attachment: e.target.value })
                    }
                    placeholder="https://..."
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Приоритет:</label>
                  <select
                    value={hwModal.priority}
                    onChange={(e) =>
                      setHwModal({ ...hwModal, priority: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="high">Высокий (Контрольная / Дедлайн)</option>
                    <option value="medium">Обычный</option>
                    <option value="low">Низкий (По желанию / Конспект)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setHwModal({ ...hwModal, open: false })}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-500/10"
              >
                Отмена
              </button>
              <button
                onClick={saveHomework}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2688EB] text-white hover:bg-blue-600"
              >
                Сохранить ДЗ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD SCHEDULE PAIR ==================== */}
      {pairModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Добавить пару в расписание</h3>
              <button
                onClick={() => setPairModal({ ...pairModal, open: false })}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Неделя:</label>
                  <select
                    value={pairModal.weekType}
                    onChange={(e) =>
                      setPairModal({ ...pairModal, weekType: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="numerator">Числитель</option>
                    <option value="denominator">Знаменатель</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">День:</label>
                  <select
                    value={pairModal.day}
                    onChange={(e) =>
                      setPairModal({ ...pairModal, day: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {DAYS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Предмет:</label>
                <input
                  type="text"
                  value={pairModal.subject}
                  onChange={(e) =>
                    setPairModal({ ...pairModal, subject: e.target.value })
                  }
                  placeholder="Название дисциплины"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">№ пары:</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={pairModal.pairNumber}
                    onChange={(e) =>
                      setPairModal({ ...pairModal, pairNumber: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Время:</label>
                  <input
                    type="text"
                    value={pairModal.time}
                    onChange={(e) =>
                      setPairModal({ ...pairModal, time: e.target.value })
                    }
                    placeholder="09:00 – 10:30"
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Тип пары:</label>
                  <select
                    value={pairModal.type}
                    onChange={(e) =>
                      setPairModal({ ...pairModal, type: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="Лекция">Лекция</option>
                    <option value="Практика">Практика</option>
                    <option value="Лабораторная">Лабораторная</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Аудитория:</label>
                  <input
                    type="text"
                    value={pairModal.room}
                    onChange={(e) =>
                      setPairModal({ ...pairModal, room: e.target.value })
                    }
                    placeholder="Ауд."
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Преподаватель:</label>
                  <input
                    type="text"
                    value={pairModal.teacher}
                    onChange={(e) =>
                      setPairModal({ ...pairModal, teacher: e.target.value })
                    }
                    placeholder="ФИО"
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Подгруппа:</label>
                  <select
                    value={pairModal.subgroup}
                    onChange={(e) =>
                      setPairModal({
                        ...pairModal,
                        subgroup: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value={0}>Общая</option>
                    <option value={1}>1 подгр.</option>
                    <option value={2}>2 подгр.</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPairModal({ ...pairModal, open: false })}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-500/10"
              >
                Отмена
              </button>
              <button
                onClick={handleAddSchedulePair}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2688EB] text-white"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD NEW STUDENT ==================== */}
      {newMemberModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Добавить участника группы</h3>
              <button
                onClick={() =>
                  setNewMemberModal({ ...newMemberModal, open: false })
                }
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold mb-1">Имя и Фамилия:</label>
                <input
                  type="text"
                  value={newMemberModal.name}
                  onChange={(e) =>
                    setNewMemberModal({
                      ...newMemberModal,
                      name: e.target.value,
                    })
                  }
                  placeholder="ФИО студента"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Тег ВК:</label>
                  <input
                    type="text"
                    value={newMemberModal.vkTag}
                    onChange={(e) =>
                      setNewMemberModal({
                        ...newMemberModal,
                        vkTag: e.target.value,
                      })
                    }
                    placeholder="@vk_id"
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Подгруппа:</label>
                  <select
                    value={newMemberModal.subgroup}
                    onChange={(e) =>
                      setNewMemberModal({
                        ...newMemberModal,
                        subgroup: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3 py-2 rounded-xl border ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value={1}>1 подгруппа</option>
                    <option value={2}>2 подгруппа</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newMemberModal.canManageHomework}
                  onChange={(e) =>
                    setNewMemberModal({
                      ...newMemberModal,
                      canManageHomework: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-[#2688EB]"
                />
                <span className="font-medium">
                  Разрешить добавлять, менять и удалять ДЗ
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() =>
                  setNewMemberModal({ ...newMemberModal, open: false })
                }
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-500/10"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (!newMemberModal.name.trim()) {
                    showToast('Введите имя участника');
                    return;
                  }
                  const added = {
                    id: 'u_' + Date.now(),
                    name: newMemberModal.name.trim(),
                    vkTag: newMemberModal.vkTag.trim() || '@vk_student',
                    subgroup: Number(newMemberModal.subgroup) || 1,
                    role: 'member',
                    avatarColor: 'bg-cyan-600',
                    permissions: {
                      canManageHomework: newMemberModal.canManageHomework,
                      canMarkAttendance: false,
                      canEditSchedule: false,
                      canManageQueues: false,
                      canPostAnnouncements: false,
                    },
                  };
                  setMembers((prev) => [...prev, added]);
                  setNewMemberModal({
                    open: false,
                    name: '',
                    vkTag: '',
                    subgroup: 1,
                    canManageHomework: false,
                  });
                  showToast('Участник добавлен в группу!');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2688EB] text-white"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CREATE LAB QUEUE ==================== */}
      {queueModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">
                Создать очередь на сдачу работы
              </h3>
              <button
                onClick={() => setQueueModal({ ...queueModal, open: false })}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold mb-1">
                  Предмет / Название лабораторной:
                </label>
                <input
                  type="text"
                  value={queueModal.subject}
                  onChange={(e) =>
                    setQueueModal({ ...queueModal, subject: e.target.value })
                  }
                  placeholder="Например: Программирование — Лаб. №1"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Дата и время пары:
                </label>
                <input
                  type="text"
                  value={queueModal.dateLabel}
                  onChange={(e) =>
                    setQueueModal({ ...queueModal, dateLabel: e.target.value })
                  }
                  placeholder="Например: Понедельник, 3 пара"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setQueueModal({ ...queueModal, open: false })}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-500/10"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (!queueModal.subject.trim()) {
                    showToast('Укажите предмет для очереди');
                    return;
                  }
                  setQueues((prev) => [
                    ...prev,
                    {
                      id: 'q_' + Date.now(),
                      subject: queueModal.subject.trim(),
                      dateLabel: queueModal.dateLabel.trim() || 'Ближайшая пара',
                      entries: [],
                    },
                  ]);
                  setQueueModal({ open: false, subject: '', dateLabel: '' });
                  showToast('Очередь на сдачу создана!');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2688EB] text-white"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CREATE FUND COLLECTION ==================== */}
      {fundModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 space-y-4 ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Открыть сбор в группе</h3>
              <button
                onClick={() => setFundModal({ ...fundModal, open: false })}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold mb-1">Цель сбора:</label>
                <input
                  type="text"
                  value={fundModal.title}
                  onChange={(e) =>
                    setFundModal({ ...fundModal, title: e.target.value })
                  }
                  placeholder="На что собираем?"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  Сумма с человека (₽):
                </label>
                <input
                  type="number"
                  min={1}
                  value={fundModal.amountPerPerson}
                  onChange={(e) =>
                    setFundModal({
                      ...fundModal,
                      amountPerPerson: e.target.value,
                    })
                  }
                  placeholder="Например: 300"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setFundModal({ ...fundModal, open: false })}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-500/10"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  if (!fundModal.title.trim()) {
                    showToast('Укажите цель сбора');
                    return;
                  }
                  setFunds((prev) => [
                    ...prev,
                    {
                      id: 'f_' + Date.now(),
                      title: fundModal.title.trim(),
                      amountPerPerson: Number(fundModal.amountPerPerson) || 100,
                      paidIds: [],
                    },
                  ]);
                  setFundModal({
                    open: false,
                    title: '',
                    amountPerPerson: '',
                  });
                  showToast('Сбор открыт!');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white"
              >
                Открыть сбор
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs sm:text-sm font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
