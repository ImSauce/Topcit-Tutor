using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Firebase.Firestore;
using Firebase.Extensions;
using UnityEngine;

///----------------------------------------------------------------------------------------------
/// Single entry point for all Firestore reads/writes.
/// Attach to the same persistent "Managers" GameObject as FirebaseManager.
///
/// Structure this mirrors:
/// Users/{userId}
///   ├─ Achievements/{achievementId}
///   ├─ Inventory/{itemId}
///   └─ Subjects/{subjectId}
///        └─ Modules/{moduleId}
///             ├─ Lessons/{lessonId}
///             └─ Quizzes/{quizId}
///----------------------------------------------------------------------------------------------
public class FirestoreManager : MonoBehaviour
{
    public static FirestoreManager Instance { get; private set; }

    private FirebaseFirestore db;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);

        db = FirebaseFirestore.DefaultInstance;
    }

    // =========================================================
    // GENERIC HELPERS — use these for anything not covered below
    // =========================================================

    /// Creates or fully overwrites a document at the given path.
    public async Task<bool> SetDocument(string path, Dictionary<string, object> data, bool merge = true)
    {
        try
        {
            DocumentReference doc = db.Document(path);
            SetOptions options = merge ? SetOptions.MergeAll : null;
            await doc.SetAsync(data, options);
            return true;
        }
        catch (Exception e)
        {
            Debug.LogError($"SetDocument failed [{path}]: {e}");
            return false;
        }
    }

    /// Updates specific fields on an existing document without touching the rest.
    public async Task<bool> UpdateFields(string path, Dictionary<string, object> fields)
    {
        try
        {
            DocumentReference doc = db.Document(path);
            await doc.UpdateAsync(fields);
            return true;
        }
        catch (Exception e)
        {
            Debug.LogError($"UpdateFields failed [{path}]: {e}");
            return false;
        }
    }

    /// Fetches a single document. Returns null if it doesn't exist or on error.
    public async Task<DocumentSnapshot> GetDocument(string path)
    {
        try
        {
            DocumentReference doc = db.Document(path);
            DocumentSnapshot snapshot = await doc.GetSnapshotAsync();
            return snapshot.Exists ? snapshot : null;
        }
        catch (Exception e)
        {
            Debug.LogError($"GetDocument failed [{path}]: {e}");
            return null;
        }
    }

    /// Fetches every document in a collection (e.g. all achievements for a user).
    public async Task<List<DocumentSnapshot>> GetCollection(string path)
    {
        try
        {
            CollectionReference collection = db.Collection(path);
            QuerySnapshot snapshot = await collection.GetSnapshotAsync();
            return new List<DocumentSnapshot>(snapshot.Documents);
        }
        catch (Exception e)
        {
            Debug.LogError($"GetCollection failed [{path}]: {e}");
            return new List<DocumentSnapshot>();
        }
    }

    public async Task<bool> DeleteDocument(string path)
    {
        try
        {
            await db.Document(path).DeleteAsync();
            return true;
        }
        catch (Exception e)
        {
            Debug.LogError($"DeleteDocument failed [{path}]: {e}");
            return false;
        }
    }

    /// Atomically increments a numeric field (points, xp, streak, hints, etc.) without a separate read.
    public async Task<bool> IncrementField(string path, string field, long amount)
    {
        return await UpdateFields(path, new Dictionary<string, object>
        {
            { field, FieldValue.Increment(amount) }
        });
    }

    // =========================================================
    // USERS
    // =========================================================

    /// Creates the initial user document. Call this right after registration.
    public async Task<bool> CreateUser(string userId, string username)
    {
        var data = new Dictionary<string, object>
        {
            { "username", username },
            { "level", 1 },
            { "xp", 0 },
            { "points", 0 },
            { "streak", 1 },
            { "hints", 0 },
            { "createdAt", FieldValue.ServerTimestamp }
        };
        return await SetDocument($"Users/{userId}", data);
    }

    public async Task<DocumentSnapshot> GetUser(string userId)
    {
        return await GetDocument($"Users/{userId}");
    }

    public async Task<bool> AddXp(string userId, long amount)
    {
        return await IncrementField($"Users/{userId}", "xp", amount);
    }

    public async Task<bool> AddPoints(string userId, long amount)
    {
        return await IncrementField($"Users/{userId}", "points", amount);
    }

    public async Task<bool> SetLevel(string userId, long level)
    {
        return await UpdateFields($"Users/{userId}", new Dictionary<string, object> { { "level", level } });
    }

    public async Task<bool> SetStreak(string userId, long streak)
    {
        return await UpdateFields($"Users/{userId}", new Dictionary<string, object> { { "streak", streak } });
    }

    public async Task<bool> UseHint(string userId)
    {
        return await IncrementField($"Users/{userId}", "hints", -1);
    }

    // =========================================================
    // ACHIEVEMENTS
    // =========================================================

    public async Task<bool> UnlockAchievement(string userId, string achievementId, string title)
    {
        var data = new Dictionary<string, object>
        {
            { "Title", title },
            { "unlocked", true },
            { "unlockedAt", FieldValue.ServerTimestamp }
        };
        return await SetDocument($"Users/{userId}/Achievements/{achievementId}", data);
    }

    public async Task<List<DocumentSnapshot>> GetAllAchievements(string userId)
    {
        return await GetCollection($"Users/{userId}/Achievements");
    }

    // =========================================================
    // INVENTORY
    // =========================================================

    public async Task<bool> UnlockItem(string userId, string itemId, string itemName)
    {
        var data = new Dictionary<string, object>
        {
            { "itemName", itemName },
            { "unlocked", true },
            { "equipped", false },
            { "unlockedAt", FieldValue.ServerTimestamp }
        };
        return await SetDocument($"Users/{userId}/Inventory/{itemId}", data);
    }

    /// Equips one item and unequips everything else in the inventory.
    public async Task<bool> EquipItem(string userId, string itemId)
    {
        List<DocumentSnapshot> items = await GetInventory(userId);

        bool allOk = true;
        foreach (DocumentSnapshot item in items)
        {
            bool shouldEquip = item.Id == itemId;
            bool ok = await UpdateFields(
                $"Users/{userId}/Inventory/{item.Id}",
                new Dictionary<string, object> { { "equipped", shouldEquip } });
            allOk &= ok;
        }
        return allOk;
    }

    public async Task<List<DocumentSnapshot>> GetInventory(string userId)
    {
        return await GetCollection($"Users/{userId}/Inventory");
    }

    // =========================================================
    // SUBJECTS
    // =========================================================

    public async Task<bool> UnlockSubject(string userId, string subjectId, string title)
    {
        var data = new Dictionary<string, object>
        {
            { "title", title },
            { "unlocked", true },
            { "unlockedAt", FieldValue.ServerTimestamp },
            { "completed", false },
            { "completedAt", null },
            { "completedModules", 0 }
        };
        return await SetDocument($"Users/{userId}/Subjects/{subjectId}", data);
    }

    public async Task<bool> CompleteSubject(string userId, string subjectId)
    {
        var data = new Dictionary<string, object>
        {
            { "completed", true },
            { "completedAt", FieldValue.ServerTimestamp }
        };
        return await UpdateFields($"Users/{userId}/Subjects/{subjectId}", data);
    }

    public async Task<bool> IncrementCompletedModules(string userId, string subjectId, long amount = 1)
    {
        return await IncrementField($"Users/{userId}/Subjects/{subjectId}", "completedModules", amount);
    }

    public async Task<DocumentSnapshot> GetSubject(string userId, string subjectId)
    {
        return await GetDocument($"Users/{userId}/Subjects/{subjectId}");
    }

    public async Task<List<DocumentSnapshot>> GetAllSubjects(string userId)
    {
        return await GetCollection($"Users/{userId}/Subjects");
    }

    // =========================================================
    // MODULES
    // =========================================================

    private string ModulePath(string userId, string subjectId, string moduleId) =>
        $"Users/{userId}/Subjects/{subjectId}/Modules/{moduleId}";

    public async Task<bool> UnlockModule(string userId, string subjectId, string moduleId, string title)
    {
        var data = new Dictionary<string, object>
        {
            { "title", title },
            { "unlocked", true },
            { "completed", false },
            { "completedLessons", 0 },
            { "completedQuizzes", 0 }
        };
        return await SetDocument(ModulePath(userId, subjectId, moduleId), data);
    }

    public async Task<bool> CompleteModule(string userId, string subjectId, string moduleId)
    {
        var data = new Dictionary<string, object> { { "completed", true } };
        return await UpdateFields(ModulePath(userId, subjectId, moduleId), data);
    }

    public async Task<bool> IncrementCompletedLessons(string userId, string subjectId, string moduleId, long amount = 1)
    {
        return await IncrementField(ModulePath(userId, subjectId, moduleId), "completedLessons", amount);
    }

    public async Task<bool> IncrementCompletedQuizzes(string userId, string subjectId, string moduleId, long amount = 1)
    {
        return await IncrementField(ModulePath(userId, subjectId, moduleId), "completedQuizzes", amount);
    }

    public async Task<DocumentSnapshot> GetModule(string userId, string subjectId, string moduleId)
    {
        return await GetDocument(ModulePath(userId, subjectId, moduleId));
    }

    public async Task<List<DocumentSnapshot>> GetAllModules(string userId, string subjectId)
    {
        return await GetCollection($"Users/{userId}/Subjects/{subjectId}/Modules");
    }

    // =========================================================
    // LESSONS
    // =========================================================

    public async Task<bool> CompleteLesson(string userId, string subjectId, string moduleId, string lessonId)
    {
        var data = new Dictionary<string, object>
        {
            { "completed", true },
            { "completedAt", FieldValue.ServerTimestamp }
        };
        string path = $"{ModulePath(userId, subjectId, moduleId)}/Lessons/{lessonId}";
        return await SetDocument(path, data);
    }

    public async Task<List<DocumentSnapshot>> GetAllLessons(string userId, string subjectId, string moduleId)
    {
        return await GetCollection($"{ModulePath(userId, subjectId, moduleId)}/Lessons");
    }

    // =========================================================
    // QUIZZES
    // =========================================================

    public async Task<bool> CompleteQuiz(
        string userId, string subjectId, string moduleId, string quizId, long score, long elapsedTimeSeconds)
    {
        var data = new Dictionary<string, object>
        {
            { "completed", true },
            { "completedAt", FieldValue.ServerTimestamp },
            { "score", score },
            { "elapsedTime", elapsedTimeSeconds }
        };
        string path = $"{ModulePath(userId, subjectId, moduleId)}/Quizzes/{quizId}";
        return await SetDocument(path, data);
    }

    public async Task<List<DocumentSnapshot>> GetAllQuizzes(string userId, string subjectId, string moduleId)
    {
        return await GetCollection($"{ModulePath(userId, subjectId, moduleId)}/Quizzes");
    }
}