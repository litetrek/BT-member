export const LANGS = { ZH: 'zh', EN: 'en' }

// Core translation helper — always call as t(lang, englishString, chineseString)
export const t = (lang, en, zh) => lang === 'en' ? en : zh

// All shared UI strings used across multiple components
// Add to this object as new strings are needed in later steps
export const UI = {
  // Status labels
  statusOpen:        (lang) => t(lang, 'Not Started',   '未開始'),
  statusInProgress:  (lang) => t(lang, 'In Progress',   '進行中'),
  statusDone:        (lang) => t(lang, 'Done',          '已完成'),
  statusOverdue:     (lang) => t(lang, 'Overdue',       '逾期'),
  // Actions
  save:              (lang) => t(lang, 'Save',          '儲存'),
  cancel:            (lang) => t(lang, 'Cancel',        '取消'),
  delete:            (lang) => t(lang, 'Delete',        '刪除'),
  edit:              (lang) => t(lang, 'Edit',          '編輯'),
  confirm:           (lang) => t(lang, 'Confirm',       '確認'),
  // Nav labels
  navDashboard:      (lang) => t(lang, 'Overview',      '總覽'),
  navActivities:     (lang) => t(lang, 'Activities',    '活動'),
  navTasks:          (lang) => t(lang, 'Tasks',         '任務'),
  navMembers:        (lang) => t(lang, 'Members',       '成員'),
  navAI:             (lang) => t(lang, 'AI Assistant',  'AI 助理'),
  // Task sections
  sectionOverdue:    (lang) => t(lang, 'Overdue',       '逾期'),
  sectionInProgress: (lang) => t(lang, 'In Progress',   '進行中'),
  sectionOpen:       (lang) => t(lang, 'Open',          '未開始'),
  sectionDone:       (lang) => t(lang, 'Done',          '已完成'),
  // Loading / empty states
  loading:           (lang) => t(lang, 'Loading…',      '載入中…'),
  noTasks:           (lang) => t(lang, 'No tasks',      '尚無任務'),
}
