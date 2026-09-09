// ============================================================================
// store.js - every Firestore read/write the admin portal performs.
//
// Mirrors the schema written by the Unity client
// (Assets/Scripts/Managers/NewUserDataInitializer.cs and FirestoreManager.cs):
//
//   Users/{uid}
//     createdAt, level, points, streak, xp, totalXp, username, hints,
//     lobbyTutorial, module            (+ admin-only fields, see below)
//     Achievements/{id}  Title, unlocked, unlockedAt
//     Inventory/{id}     equipped, itemName, unlocked, unlockedAt
//     Subjects/{id}      completed, completedAt, completedModules, unlocked,
//                        unlockedAt, title
//       Modules/{id}     completed, completedAt, completedLessons,
//                        completedQuizzes, unlocked, title
//         Lessons/{id}   completed, completedAt
//         Quizzes/{id}   completed, completedAt, elapsedTime, score
//
// Admin-only fields added to Users/{uid} by this portal:
//   disabled (bool), disabledReason, email, adminNotes, updatedAt, updatedBy
//
// Collections owned entirely by the portal:
//   Admins/{uid}              who may sign in here
//   AchievementCatalog/{id}   master achievement/badge definitions
//   ItemCatalog/{id}          master shop / collectible definitions
//   SubjectCatalog/{id}       master curriculum (Modules > Lessons/Quizzes)
//   Announcements/{id}        messages for students
//   Config/gamification       XP curve + reward tuning
//   AdminLogs/{auto}          audit trail of every change made here
// ============================================================================

import {
  db, auth, collection, collectionGroup, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp,
  writeBatch, increment, getCountFromServer, initializeApp, deleteApp, getAuth,
  createUserWithEmailAndPassword, sendPasswordResetEmail, firebaseConfig
} from "./firebase.js";
import { applyXpGain, LEVELING, toDate } from "./util.js";

export const COL = {
  users: "Users",
  admins: "Admins",
  achievementCatalog: "AchievementCatalog",
  itemCatalog: "ItemCatalog",
  subjectCatalog: "SubjectCatalog",
  announcements: "Announcements",
  config: "Config",
  logs: "AdminLogs"
};

const BATCH_LIMIT = 400;

// ---------------------------------------------------------------------------
// Generic document / collection helpers (also power the Database Explorer)
// ---------------------------------------------------------------------------

export async function listCollection(path, { orderField = null, max = 0 } = {}) {
  let ref = collection(db, path);
  const clauses = [];
  if (orderField) clauses.push(orderBy(orderField));
  if (max) clauses.push(limit(max));
  const snap = await getDocs(clauses.length ? query(ref, ...clauses) : ref);
  return snap.docs.map((d) => ({ id: d.id, path: d.ref.path, ...d.data() }));
}

export async function getDocument(path) {
  const snap = await getDoc(doc(db, path));
  return snap.exists() ? { id: snap.id, path: snap.ref.path, ...snap.data() } : null;
}

export async function setDocument(path, data, merge = true) {
  await setDoc(doc(db, path), data, { merge });
}

export async function updateDocument(path, data) {
  await updateDoc(doc(db, path), data);
}

export async function deleteDocument(path) {
  await deleteDoc(doc(db, path));
}

export async function countCollection(path) {
  try {
    const snap = await getCountFromServer(collection(db, path));
    return snap.data().count;
  } catch {
    const snap = await getDocs(collection(db, path));
    return snap.size;
  }
}

/** Count documents in a collection group, optionally filtered. */
export async function countGroup(groupName, filters = []) {
  const base = collectionGroup(db, groupName);
  const q = filters.length ? query(base, ...filters) : base;
  try {
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch (err) {
    // Aggregation or the required index may be unavailable - fall back to a read.
    try {
      const snap = await getDocs(q);
      return snap.size;
    } catch (inner) {
      console.warn(`countGroup(${groupName}) failed:`, inner);
      return null;
    }
  }
}

export { where as fsWhere, orderBy as fsOrderBy };

/**
 * Which subcollections can live under a given document path.
 * The web SDK cannot enumerate subcollections, so the schema is declared here.
 */
export function subcollectionsFor(path) {
  const p = path.split("/").filter(Boolean);
  if (p.length % 2 !== 0) return [];                        // it's a collection
  const parent = p[p.length - 2];
  if (parent === COL.users) return ["Achievements", "Inventory", "Subjects"];
  if (parent === "Subjects") return ["Modules"];
  if (parent === "Modules") return ["Lessons", "Quizzes"];
  if (parent === COL.subjectCatalog) return ["Modules"];
  return [];
}

export const ROOT_COLLECTIONS = [
  COL.users, COL.admins, COL.achievementCatalog, COL.itemCatalog,
  COL.subjectCatalog, COL.announcements, COL.config, COL.logs
];

/** Delete a document and everything nested beneath it. */
export async function deleteRecursive(path, onProgress = () => {}) {
  let deleted = 0;
  const walk = async (docPath) => {
    for (const sub of subcollectionsFor(docPath)) {
      const snap = await getDocs(collection(db, `${docPath}/${sub}`));
      for (const d of snap.docs) await walk(d.ref.path);
    }
    await deleteDoc(doc(db, docPath));
    deleted += 1;
    onProgress(deleted);
  };
  await walk(path);
  return deleted;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function logAction(action, target = "", details = {}) {
  try {
    await addDoc(collection(db, COL.logs), {
      action,
      target,
      details,
      at: serverTimestamp(),
      adminUid: auth.currentUser ? auth.currentUser.uid : "unknown",
      adminEmail: auth.currentUser ? auth.currentUser.email : "unknown"
    });
  } catch (err) {
    // Never let audit logging break the operation that triggered it.
    console.warn("Audit log write failed:", err);
  }
}

export async function listLogs(max = 200) {
  try {
    const snap = await getDocs(query(collection(db, COL.logs), orderBy("at", "desc"), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

export async function fetchAdminRecord(uid) {
  const snap = await getDoc(doc(db, COL.admins, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export const listAdmins = () => listCollection(COL.admins);

export async function saveAdmin(uid, data) {
  await setDoc(doc(db, COL.admins, uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  await logAction("admin.save", `${COL.admins}/${uid}`, data);
}

export async function removeAdmin(uid) {
  await deleteDoc(doc(db, COL.admins, uid));
  await logAction("admin.remove", `${COL.admins}/${uid}`);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** All student profile documents (no subcollections). Sorted newest first. */
export async function listUsers({ max = 1000 } = {}) {
  const snap = await getDocs(max ? query(collection(db, COL.users), limit(max)) : collection(db, COL.users));
  const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  users.sort((a, b) => {
    const da = toDate(a.createdAt), dbb = toDate(b.createdAt);
    if (da && dbb) return dbb - da;
    if (da) return -1;
    if (dbb) return 1;
    return String(a.username || "").localeCompare(String(b.username || ""));
  });
  return users;
}

export const getUser = (uid) => getDocument(`${COL.users}/${uid}`);

export async function updateUser(uid, data) {
  await updateDoc(doc(db, COL.users, uid), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.email : "admin"
  });
  await logAction("user.update", `${COL.users}/${uid}`, data);
}

export async function setUserDisabled(uid, disabled, reason = "") {
  await updateUser(uid, { disabled, disabledReason: disabled ? reason : "" });
  await logAction(disabled ? "user.deactivate" : "user.reactivate", `${COL.users}/${uid}`, { reason });
}

/** Deletes the profile plus Achievements / Inventory / Subjects / Modules / ... */
export async function deleteUser(uid, onProgress) {
  const count = await deleteRecursive(`${COL.users}/${uid}`, onProgress);
  await logAction("user.delete", `${COL.users}/${uid}`, { documentsDeleted: count });
  return count;
}

/** Leaderboard: students ranked by a numeric field. */
export async function leaderboard(field = "totalXp", max = 100) {
  try {
    const snap = await getDocs(query(collection(db, COL.users), orderBy(field, "desc"), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    // Docs missing the field are skipped by orderBy - fall back to client sort.
    const users = await listUsers();
    return users
      .filter((u) => typeof u[field] === "number")
      .sort((a, b) => (b[field] || 0) - (a[field] || 0))
      .slice(0, max);
  }
}

// ---------------------------------------------------------------------------
// Creating student accounts
// ---------------------------------------------------------------------------

/**
 * Creates a Firebase Auth account + the full starter data set, without signing
 * the current admin out. A throwaway secondary Firebase app is used so the
 * new sign-in never touches the admin's session.
 */
export async function createStudentAccount({ email, password, username }) {
  const secondary = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await seedNewUser(uid, username, email);
    await secondaryAuth.signOut();
    await logAction("user.create", `${COL.users}/${uid}`, { email, username });
    return uid;
  } finally {
    await deleteApp(secondary).catch(() => {});
  }
}

/**
 * Writes the same starter data NewUserDataInitializer.cs writes, but sourced
 * from the admin-managed catalogs so seeding stays in sync with the content
 * you configure in this portal. Falls back to the Unity defaults when the
 * catalogs are empty.
 */
export async function seedNewUser(uid, username, email = "") {
  const userRef = doc(db, COL.users, uid);
  await setDoc(userRef, {
    username,
    email,
    createdAt: serverTimestamp(),
    level: 1,
    xp: 0,
    totalXp: 0,
    points: 0,
    streak: 1,
    hints: 0,
    lobbyTutorial: false,
    module: false,
    disabled: false
  }, { merge: true });

  const [achievements, items, subjects] = await Promise.all([
    listCollection(COL.achievementCatalog).catch(() => []),
    listCollection(COL.itemCatalog).catch(() => []),
    listCollection(COL.subjectCatalog).catch(() => [])
  ]);

  const seedAchievements = achievements.length
    ? achievements
    : [{ id: "achievement_1", title: "First Login" }];
  const seedItems = items.length ? items : [{ id: "item_1", itemName: "Laptop" }];

  const batch = writeBatch(db);
  seedAchievements.forEach((a) => {
    batch.set(doc(db, `${COL.users}/${uid}/Achievements/${a.id}`), {
      Title: a.title || a.Title || a.id,
      unlocked: true,
      unlockedAt: null
    });
  });
  seedItems.forEach((i) => {
    batch.set(doc(db, `${COL.users}/${uid}/Inventory/${i.id}`), {
      itemName: i.itemName || i.title || i.id,
      equipped: false,
      unlocked: true,
      unlockedAt: null
    });
  });
  await batch.commit();

  if (subjects.length) {
    for (const s of subjects) await pushSubjectToUser(uid, s.id);
  } else {
    // Unity default: subject_1 > module_1 > lesson_1 + quiz_1
    const sPath = `${COL.users}/${uid}/Subjects/subject_1`;
    await setDoc(doc(db, sPath), {
      title: "01 Software Development - Technical Field",
      completed: false, completedAt: null, completedModules: 0,
      unlocked: true, unlockedAt: null
    });
    const mPath = `${sPath}/Modules/module_1`;
    await setDoc(doc(db, mPath), {
      title: "Overview", completed: false, completedAt: null,
      completedLessons: 0, completedQuizzes: 0, unlocked: true
    });
    await setDoc(doc(db, `${mPath}/Lessons/lesson_1`), { completed: false, completedAt: null });
    await setDoc(doc(db, `${mPath}/Quizzes/quiz_1`), {
      completed: false, completedAt: null, elapsedTime: 0, score: 0
    });
  }
}

export const sendReset = (email) => sendPasswordResetEmail(auth, email);

// ---------------------------------------------------------------------------
// Per-student subcollections
// ---------------------------------------------------------------------------

export const listUserAchievements = (uid) => listCollection(`${COL.users}/${uid}/Achievements`);
export const listUserInventory    = (uid) => listCollection(`${COL.users}/${uid}/Inventory`);
export const listUserSubjects     = (uid) => listCollection(`${COL.users}/${uid}/Subjects`);
export const listUserModules      = (uid, sid) => listCollection(`${COL.users}/${uid}/Subjects/${sid}/Modules`);
export const listUserLessons      = (uid, sid, mid) => listCollection(`${COL.users}/${uid}/Subjects/${sid}/Modules/${mid}/Lessons`);
export const listUserQuizzes      = (uid, sid, mid) => listCollection(`${COL.users}/${uid}/Subjects/${sid}/Modules/${mid}/Quizzes`);

/** Full nested progress tree for one student. */
export async function getProgressTree(uid) {
  const subjects = await listUserSubjects(uid);
  subjects.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  for (const s of subjects) {
    s.modules = await listUserModules(uid, s.id);
    s.modules.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    for (const m of s.modules) {
      const [lessons, quizzes] = await Promise.all([
        listUserLessons(uid, s.id, m.id),
        listUserQuizzes(uid, s.id, m.id)
      ]);
      const byId = (a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
      m.lessons = lessons.sort(byId);
      m.quizzes = quizzes.sort(byId);
    }
  }
  return subjects;
}

/** Flat totals for one student, derived from the progress tree. */
export function summarizeTree(subjects) {
  const s = {
    subjects: subjects.length, subjectsDone: 0,
    modules: 0, modulesDone: 0,
    lessons: 0, lessonsDone: 0,
    quizzes: 0, quizzesDone: 0,
    scoreSum: 0, scoreCount: 0, timeSum: 0
  };
  subjects.forEach((sub) => {
    if (sub.completed) s.subjectsDone += 1;
    (sub.modules || []).forEach((m) => {
      s.modules += 1;
      if (m.completed) s.modulesDone += 1;
      (m.lessons || []).forEach((l) => {
        s.lessons += 1;
        if (l.completed) s.lessonsDone += 1;
      });
      (m.quizzes || []).forEach((q) => {
        s.quizzes += 1;
        if (q.completed) {
          s.quizzesDone += 1;
          s.scoreSum += Number(q.score) || 0;
          s.scoreCount += 1;
          s.timeSum += Number(q.elapsedTime) || 0;
        }
      });
    });
  });
  s.avgScore = s.scoreCount ? s.scoreSum / s.scoreCount : 0;
  s.avgTime = s.scoreCount ? s.timeSum / s.scoreCount : 0;
  return s;
}

// ---------------------------------------------------------------------------
// XP / points / level operations (level math mirrors LevelingRules.cs)
// ---------------------------------------------------------------------------

export async function grantXp(uid, amount, rules = LEVELING) {
  const user = await getUser(uid);
  if (!user) throw new Error("User not found.");
  const { level, xp } = applyXpGain(user.level || 1, user.xp || 0, amount, rules);
  const totalXp = Math.max(0, (Number(user.totalXp) || 0) + Number(amount));
  await updateUser(uid, { level, xp, totalXp });
  await logAction("user.grantXp", `${COL.users}/${uid}`, { amount, level, xp, totalXp });
  return { level, xp, totalXp };
}

export async function grantPoints(uid, amount) {
  await updateDoc(doc(db, COL.users, uid), { points: increment(Number(amount) || 0) });
  await logAction("user.grantPoints", `${COL.users}/${uid}`, { amount });
}

export async function bulkGrant(uids, { xp = 0, points = 0, hints = 0 }, rules = LEVELING, onProgress = () => {}) {
  let done = 0;
  for (const uid of uids) {
    if (xp) await grantXp(uid, xp, rules);
    if (points) await grantPoints(uid, points);
    if (hints) await updateDoc(doc(db, COL.users, uid), { hints: increment(Number(hints)) });
    onProgress(++done, uids.length);
  }
  await logAction("users.bulkGrant", `${uids.length} students`, { xp, points, hints });
}

/** Season reset: zeroes the chosen leaderboard fields for every listed student. */
export async function resetLeaderboard(uids, fields = { xp: true, totalXp: true, level: true, points: false, streak: false }) {
  const payload = {};
  if (fields.xp) payload.xp = 0;
  if (fields.totalXp) payload.totalXp = 0;
  if (fields.level) payload.level = 1;
  if (fields.points) payload.points = 0;
  if (fields.streak) payload.streak = 0;
  if (Object.keys(payload).length === 0) return 0;

  for (let i = 0; i < uids.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    uids.slice(i, i + BATCH_LIMIT).forEach((uid) => {
      batch.set(doc(db, COL.users, uid), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
  await logAction("leaderboard.reset", `${uids.length} students`, payload);
  return uids.length;
}

/**
 * Recomputes level + capped xp from each student's totalXp using the current
 * XP curve. Use after changing the curve in Settings.
 */
export async function recalcLevels(users, rules = LEVELING) {
  let changed = 0;
  for (let i = 0; i < users.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    let inBatch = 0;
    users.slice(i, i + BATCH_LIMIT).forEach((u) => {
      const { level, xp } = applyXpGain(1, 0, Number(u.totalXp) || 0, rules);
      if (level !== u.level || xp !== u.xp) {
        batch.set(doc(db, COL.users, u.id), { level, xp, updatedAt: serverTimestamp() }, { merge: true });
        inBatch += 1;
      }
    });
    if (inBatch) { await batch.commit(); changed += inBatch; }
  }
  await logAction("leaderboard.recalcLevels", `${changed} students`, rules);
  return changed;
}

// ---------------------------------------------------------------------------
// Catalog -> student propagation
// ---------------------------------------------------------------------------

/** Grants a catalog achievement to one student (kept unlocked-state safe). */
export async function pushAchievementToUser(uid, achievement, { overwriteTitle = true } = {}) {
  const path = `${COL.users}/${uid}/Achievements/${achievement.id}`;
  const existing = await getDocument(path);
  if (existing) {
    if (overwriteTitle) await setDocument(path, { Title: achievement.title }, true);
  } else {
    await setDocument(path, { Title: achievement.title, unlocked: true, unlockedAt: null }, false);
  }
}

export async function pushItemToUser(uid, item, { overwriteName = true } = {}) {
  const path = `${COL.users}/${uid}/Inventory/${item.id}`;
  const existing = await getDocument(path);
  if (existing) {
    if (overwriteName) await setDocument(path, { itemName: item.itemName }, true);
  } else {
    await setDocument(path, { itemName: item.itemName, equipped: false, unlocked: true, unlockedAt: null }, false);
  }
}

/** Copies a catalog subject (with modules, lessons, quizzes) into a student. */
export async function pushSubjectToUser(uid, subjectId) {
  const subject = await getDocument(`${COL.subjectCatalog}/${subjectId}`);
  if (!subject) throw new Error(`Subject "${subjectId}" is not in the catalog.`);

  const sPath = `${COL.users}/${uid}/Subjects/${subjectId}`;
  const existingSubject = await getDocument(sPath);
  await setDocument(sPath, existingSubject
    ? { title: subject.title }
    : {
        title: subject.title, completed: false, completedAt: null, completedModules: 0,
        unlocked: subject.unlockedByDefault !== false, unlockedAt: null
      }, true);

  const modules = await listCollection(`${COL.subjectCatalog}/${subjectId}/Modules`);
  for (const m of modules) {
    const mPath = `${sPath}/Modules/${m.id}`;
    const existingModule = await getDocument(mPath);
    await setDocument(mPath, existingModule
      ? { title: m.title }
      : {
          title: m.title, completed: false, completedAt: null,
          completedLessons: 0, completedQuizzes: 0,
          unlocked: m.unlockedByDefault !== false
        }, true);

    const lessonIds = Array.isArray(m.lessonIds) ? m.lessonIds : [];
    const quizIds = Array.isArray(m.quizIds) ? m.quizIds : [];
    const batch = writeBatch(db);
    lessonIds.forEach((lid) => {
      batch.set(doc(db, `${mPath}/Lessons/${lid}`), { completed: false, completedAt: null }, { merge: true });
    });
    quizIds.forEach((qid) => {
      batch.set(doc(db, `${mPath}/Quizzes/${qid}`),
        { completed: false, completedAt: null, elapsedTime: 0, score: 0 }, { merge: true });
    });
    if (lessonIds.length || quizIds.length) await batch.commit();
  }
}

/** Applies a push function to every student, reporting progress. */
export async function pushToAllUsers(kind, payload, onProgress = () => {}) {
  const users = await listUsers();
  let done = 0;
  for (const u of users) {
    if (kind === "achievement") await pushAchievementToUser(u.id, payload);
    else if (kind === "item") await pushItemToUser(u.id, payload);
    else if (kind === "subject") await pushSubjectToUser(u.id, payload.id);
    onProgress(++done, users.length);
  }
  await logAction(`catalog.pushAll.${kind}`, payload.id || "", { students: users.length });
  return users.length;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG = {
  startingXpCap: 50,
  xpIncreasePerLevel: 10,
  xpPerLesson: 10,
  xpPerQuiz: 25,
  pointsPerLesson: 5,
  pointsPerQuiz: 15,
  dailyStreakXp: 5,
  hintCost: 20,
  maxStreakBonus: 50
};

export async function getConfig() {
  const cfg = await getDocument(`${COL.config}/gamification`);
  return { ...DEFAULT_CONFIG, ...(cfg || {}) };
}

export async function saveConfig(data) {
  await setDocument(`${COL.config}/gamification`, { ...data, updatedAt: serverTimestamp() }, true);
  await logAction("config.save", `${COL.config}/gamification`, data);
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export async function listAnnouncements() {
  const items = await listCollection(COL.announcements);
  items.sort((a, b) => (toDate(b.publishedAt) || 0) - (toDate(a.publishedAt) || 0));
  return items;
}

export async function saveAnnouncement(id, data) {
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
    author: auth.currentUser ? auth.currentUser.email : "admin"
  };
  if (id) {
    await setDocument(`${COL.announcements}/${id}`, payload, true);
    await logAction("announcement.update", `${COL.announcements}/${id}`, { title: data.title });
    return id;
  }
  const ref = await addDoc(collection(db, COL.announcements), { ...payload, publishedAt: serverTimestamp() });
  await logAction("announcement.create", ref.path, { title: data.title });
  return ref.id;
}

export async function deleteAnnouncement(id) {
  await deleteDoc(doc(db, COL.announcements, id));
  await logAction("announcement.delete", `${COL.announcements}/${id}`);
}

// ---------------------------------------------------------------------------
// Analytics (walks every student's subcollections - use the refresh button)
// ---------------------------------------------------------------------------

export async function computeAnalytics(onProgress = () => {}) {
  const users = await listUsers();
  const result = {
    generatedAt: new Date(),
    users: users.length,
    active7: 0, active30: 0, newThisWeek: 0, disabled: 0,
    totalXp: 0, totalPoints: 0, avgLevel: 0, maxStreak: 0,
    lessons: 0, lessonsDone: 0,
    quizzes: 0, quizzesDone: 0,
    modules: 0, modulesDone: 0,
    subjects: 0, subjectsDone: 0,
    scoreSum: 0, scoreCount: 0, timeSum: 0,
    scoreBuckets: [0, 0, 0, 0, 0],           // 0-20, 21-40, 41-60, 61-80, 81-100
    perUser: [],
    perQuiz: new Map(),                       // quizId -> { attempts, scoreSum, timeSum }
    perModule: new Map(),                     // "subject/module" -> { title, done, total }
    signupsByDay: new Map()
  };

  const now = Date.now();
  const day = 864e5;

  let done = 0;
  for (const u of users) {
    result.totalXp += Number(u.totalXp) || 0;
    result.totalPoints += Number(u.points) || 0;
    result.avgLevel += Number(u.level) || 0;
    result.maxStreak = Math.max(result.maxStreak, Number(u.streak) || 0);
    if (u.disabled) result.disabled += 1;

    const created = toDate(u.createdAt);
    if (created) {
      const key = created.toISOString().slice(0, 10);
      result.signupsByDay.set(key, (result.signupsByDay.get(key) || 0) + 1);
      if (now - created.getTime() <= 7 * day) result.newThisWeek += 1;
    }
    const seen = toDate(u.updatedAt) || toDate(u.lastActiveAt) || created;
    if (seen) {
      if (now - seen.getTime() <= 7 * day) result.active7 += 1;
      if (now - seen.getTime() <= 30 * day) result.active30 += 1;
    }

    const tree = await getProgressTree(u.id);
    const sum = summarizeTree(tree);
    result.subjects += sum.subjects; result.subjectsDone += sum.subjectsDone;
    result.modules += sum.modules;   result.modulesDone += sum.modulesDone;
    result.lessons += sum.lessons;   result.lessonsDone += sum.lessonsDone;
    result.quizzes += sum.quizzes;   result.quizzesDone += sum.quizzesDone;
    result.scoreSum += sum.scoreSum; result.scoreCount += sum.scoreCount;
    result.timeSum += sum.timeSum;

    tree.forEach((s) => (s.modules || []).forEach((m) => {
      const key = `${s.id}/${m.id}`;
      const entry = result.perModule.get(key) || { title: `${s.title || s.id} › ${m.title || m.id}`, done: 0, total: 0 };
      entry.total += 1;
      if (m.completed) entry.done += 1;
      result.perModule.set(key, entry);

      (m.quizzes || []).forEach((q) => {
        if (!q.completed) return;
        const qk = `${m.title || m.id} › ${q.id}`;
        const stat = result.perQuiz.get(qk) || { attempts: 0, scoreSum: 0, timeSum: 0 };
        stat.attempts += 1;
        stat.scoreSum += Number(q.score) || 0;
        stat.timeSum += Number(q.elapsedTime) || 0;
        result.perQuiz.set(qk, stat);
        const score = Number(q.score) || 0;
        const bucket = Math.min(4, Math.floor(score / 20.0001));
        result.scoreBuckets[bucket] += 1;
      });
    }));

    result.perUser.push({
      uid: u.id,
      username: u.username || "(no username)",
      email: u.email || "",
      level: u.level || 1,
      xp: u.xp || 0,
      totalXp: u.totalXp || 0,
      points: u.points || 0,
      streak: u.streak || 0,
      disabled: !!u.disabled,
      createdAt: created,
      ...sum
    });

    onProgress(++done, users.length);
  }

  result.avgLevel = users.length ? result.avgLevel / users.length : 0;
  result.avgScore = result.scoreCount ? result.scoreSum / result.scoreCount : 0;
  result.avgTime = result.scoreCount ? result.timeSum / result.scoreCount : 0;
  return result;
}
