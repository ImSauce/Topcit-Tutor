using System.Collections.Generic;
using System.Threading.Tasks;
using Firebase.Firestore;

///----------------------------------------------------------------------------------------------
/// WHAT THIS SCRIPT DOES (in plain English):
///
/// This script builds the "starter kit" of data that every brand new player gets,
/// the moment their account is created. It writes all of this into Firestore
/// (your database) so the game has something to read from right away.
///
/// It builds, in this order:
///   1) The player's main profile (level, points, xp, etc.)
///   2) Their starting Achievements
///   3) Their starting Inventory items
///   4) Their starting Subjects, and everything nested inside each Subject:
///        Subject -> Modules -> Lessons and Quizzes
///
/// HOW TO ADD MORE CONTENT LATER:
/// You don't need to touch the "building" code below at all. Just scroll down to
/// the "NewUserContent" section and add a new line to the matching list. For
/// example, to give every new player a second achievement, add one line inside
/// StarterAchievements. The script will automatically create it for every new
/// player from then on. (This does NOT affect players who already exist -
/// it only affects new sign-ups.)
///----------------------------------------------------------------------------------------------


// =====================================================================================
// PART 1: THE CONTENT LIST
// This is the ONLY part you should need to edit as you add more achievements,
// items, subjects, modules, lessons, and quizzes to your game.
// =====================================================================================
public static class NewUserContent
{
    // Every new player starts with these achievements (locked-and-loaded, but "unlocked"
    // here just means "visible/available" - not necessarily earned yet, matching your setup).
    public static readonly List<AchievementSeed> StarterAchievements = new List<AchievementSeed>
    {
        new AchievementSeed(id: "achievement_1", title: "First Login")

        // To add another achievement later, copy the line above and change the details, e.g:
        // new AchievementSeed(id: "achievement_2", title: "Finish Your First Quiz")
    };

    // Every new player starts with these inventory items.
    public static readonly List<ItemSeed> StarterItems = new List<ItemSeed>
    {
        new ItemSeed(id: "item_1", itemName: "Laptop")

        // new ItemSeed(id: "item_2", itemName: "Notebook")
    };

    // Every new player starts with these subjects. Each subject can contain modules,
    // and each module can contain lessons and quizzes - just like your diagram.
    public static readonly List<SubjectSeed> StarterSubjects = new List<SubjectSeed>
    {
        new SubjectSeed(
            id: "subject_1",
            title: "01 Software Development - Technical Field",
            modules: new List<ModuleSeed>
            {
                new ModuleSeed(
                    id: "module_1",
                    title: "Overview",
                    lessonIds: new List<string> { "lesson_1" },
                    quizIds: new List<string> { "quiz_1" }
                )

                // To add another module to this same subject, copy the block above, e.g:
                // new ModuleSeed(
                //     id: "module_2",
                //     title: "Setting Up Your Tools",
                //     lessonIds: new List<string> { "lesson_1", "lesson_2" },
                //     quizIds: new List<string> { "quiz_1" }
                // )
            }
        )

        // To add a whole new subject later, copy the entire block above and change the details:
        // new SubjectSeed(
        //     id: "subject_2",
        //     title: "02 Some Other Field",
        //     modules: new List<ModuleSeed> { ... }
        // )
    };
}

// =====================================================================================
// PART 2: THE "SHAPE" OF EACH PIECE OF CONTENT
// These are just simple containers that hold the details for one achievement,
// one item, one subject, or one module. You don't need to edit anything here.
// =====================================================================================

public class AchievementSeed
{
    public string Id;
    public string Title;

    // This is "object" (not "Timestamp") on purpose, so it can hold EITHER
    // an actual timestamp OR just plain null - Timestamp by itself can't be null.
    public object UnlockedAt;

    // "unlockedAt = null" means: if you don't type anything for this when
    // creating a new achievement, it will automatically just be null.
    public AchievementSeed(string id, string title, object unlockedAt = null)
    {
        Id = id;
        Title = title;
        UnlockedAt = unlockedAt;
    }
}

public class ItemSeed
{
    public string Id;
    public string ItemName;

    public ItemSeed(string id, string itemName)
    {
        Id = id;
        ItemName = itemName;
    }
}

public class ModuleSeed
{
    public string Id;
    public string Title;
    public List<string> LessonIds;
    public List<string> QuizIds;

    public ModuleSeed(string id, string title, List<string> lessonIds, List<string> quizIds)
    {
        Id = id;
        Title = title;
        LessonIds = lessonIds;
        QuizIds = quizIds;
    }
}

public class SubjectSeed
{
    public string Id;
    public string Title;
    public List<ModuleSeed> Modules;

    public SubjectSeed(string id, string title, List<ModuleSeed> modules)
    {
        Id = id;
        Title = title;
        Modules = modules;
    }
}

// =====================================================================================
// PART 3: THE "BUILDER"
// This is the part that actually talks to Firestore and saves everything.
// You should not need to edit this - it just reads whatever is in Part 1 (above)
// and writes it into the database, no matter how long those lists get.
// =====================================================================================
public static class NewUserDataInitializer
{
    /// <summary>
    /// Call this ONE TIME, right after a brand new account is created.
    /// It builds that player's entire starter data set inside Firestore.
    /// </summary>
    /// <param name="db">Your Firestore database reference.</param>
    /// <param name="userId">The unique ID Firebase gave this player when their account was made.</param>
    /// <param name="username">The username the player chose when registering.</param>
    public static async Task CreateNewUserData(FirebaseFirestore db, string userId, string username)
    {
        // This points at this player's personal folder: Users -> (their ID)
        DocumentReference userDoc = db.Collection("Users").Document(userId);

        // ---- Step 1: Save the main profile fields ----
        Dictionary<string, object> profileData = new Dictionary<string, object>
        {
            { "createdAt", Timestamp.GetCurrentTimestamp() },
            { "hints", 0 },
            { "level", 1 },
            { "points", 0 },
            { "streak", 1 },
            { "lobbyTutorial", false },
            { "module", false },
            { "username", username },
            { "xp", 1 }
        };
        await userDoc.SetAsync(profileData);

        // ---- Step 2: Save every achievement listed in Part 1 ----
        foreach (AchievementSeed achievement in NewUserContent.StarterAchievements)
        {
            Dictionary<string, object> achievementData = new Dictionary<string, object>
            {
                { "Title", achievement.Title },
                { "unlocked", true },
                { "unlockedAt", achievement.UnlockedAt }
            };

            await userDoc.Collection("Achievements").Document(achievement.Id).SetAsync(achievementData);
        }

        // ---- Step 3: Save every inventory item listed in Part 1 ----
        foreach (ItemSeed item in NewUserContent.StarterItems)
        {
            Dictionary<string, object> itemData = new Dictionary<string, object>
            {
                { "equipped", false },
                { "itemName", item.ItemName },
                { "unlocked", true },
                { "unlockedAt", null }
            };

            await userDoc.Collection("Inventory").Document(item.Id).SetAsync(itemData);
        }

        // ---- Step 4: Save every subject, and everything nested inside it ----
        foreach (SubjectSeed subject in NewUserContent.StarterSubjects)
        {
            DocumentReference subjectDoc = userDoc.Collection("Subjects").Document(subject.Id);

            Dictionary<string, object> subjectData = new Dictionary<string, object>
            {
                { "completed", false },
                { "completedAt", null },
                { "completedModules", 0 },
                { "unlocked", true },
                { "unlockedAt", null },
                { "title", subject.Title }
            };
            await subjectDoc.SetAsync(subjectData);

            // Each subject can have several modules inside it.
            foreach (ModuleSeed module in subject.Modules)
            {
                DocumentReference moduleDoc = subjectDoc.Collection("Modules").Document(module.Id);

                Dictionary<string, object> moduleData = new Dictionary<string, object>
                {
                    { "completed", false },
                    { "completedAt", null },
                    { "completedLessons", 0 },
                    { "completedQuizzes", 0 },
                    { "unlocked", true },
                    { "title", module.Title }
                };
                await moduleDoc.SetAsync(moduleData);

                // Each module can have several lessons inside it.
                foreach (string lessonId in module.LessonIds)
                {
                    Dictionary<string, object> lessonData = new Dictionary<string, object>
                    {
                        { "completed", false },
                        { "completedAt", null }
                    };
                    await moduleDoc.Collection("Lessons").Document(lessonId).SetAsync(lessonData);
                }

                // Each module can have several quizzes inside it.
                foreach (string quizId in module.QuizIds)
                {
                    Dictionary<string, object> quizData = new Dictionary<string, object>
                    {
                        { "completed", false },
                        { "completedAt", null },
                        { "elapsedTime", 0 },
                        { "score", 0 }
                    };
                    await moduleDoc.Collection("Quizzes").Document(quizId).SetAsync(quizData);
                }
            }
        }
    }
}