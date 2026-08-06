using UnityEngine.Analytics;
using System.Collections.Generic;

public class AnalyticsManager
{
    // =========================
    // GAME
    // =========================

    public static void GameStarted()
    {
        Analytics.CustomEvent("game_started");
    }

    public static void GameClosed()
    {
        Analytics.CustomEvent("game_closed");
    }

    // =========================
    // LOGIN
    // =========================

    public static void Login()
    {
        Analytics.CustomEvent("login");
    }

    public static void Register()
    {
        Analytics.CustomEvent("register");
    }

    public static void Logout()
    {
        Analytics.CustomEvent("logout");
    }

    // =========================
    // MENU
    // =========================

    public static void MainMenuOpened()
    {
        Analytics.CustomEvent("main_menu");
    }

    public static void SettingsOpened()
    {
        Analytics.CustomEvent("settings_opened");
    }

    public static void CreditsOpened()
    {
        Analytics.CustomEvent("credits_opened");
    }

    // =========================
    // SUBJECTS
    // =========================

    public static void SubjectUnlocked(string subjectId, string title)
    {
        Analytics.CustomEvent("subject_unlocked",
            new Dictionary<string, object>
            {
                { "subjectId", subjectId },
                { "title", title }
            });
    }

    public static void SubjectCompleted(string subjectId)
    {
        Analytics.CustomEvent("subject_completed",
            new Dictionary<string, object>
            {
                { "subjectId", subjectId }
            });
    }

    // =========================
    // MODULES
    // =========================

    public static void ModuleUnlocked(string moduleId, string title)
    {
        Analytics.CustomEvent("module_unlocked",
            new Dictionary<string, object>
            {
                { "moduleId", moduleId },
                { "title", title }
            });
    }

    public static void ModuleCompleted(string moduleId)
    {
        Analytics.CustomEvent("module_completed",
            new Dictionary<string, object>
            {
                { "moduleId", moduleId }
            });
    }

    // =========================
    // LESSONS
    // =========================

    public static void LessonStarted(string lessonId)
    {
        Analytics.CustomEvent("lesson_started",
            new Dictionary<string, object>
            {
                { "lessonId", lessonId }
            });
    }

    public static void LessonCompleted(string lessonId)
    {
        Analytics.CustomEvent("lesson_completed",
            new Dictionary<string, object>
            {
                { "lessonId", lessonId }
            });
    }

    // =========================
    // QUIZZES
    // =========================

    public static void QuizStarted(string quizId)
    {
        Analytics.CustomEvent("quiz_started",
            new Dictionary<string, object>
            {
                { "quizId", quizId }
            });
    }

    public static void QuizCompleted(string quizId, int score, float elapsedTimeSeconds)
    {
        Analytics.CustomEvent("quiz_completed",
            new Dictionary<string, object>
            {
                { "quizId", quizId },
                { "score", score },
                { "elapsedTime", elapsedTimeSeconds }
            });
    }

    public static void QuizFailed(string quizId)
    {
        Analytics.CustomEvent("quiz_failed",
            new Dictionary<string, object>
            {
                { "quizId", quizId }
            });
    }

    // =========================
    // QUESTIONS
    // =========================

    public static void CorrectAnswer()
    {
        Analytics.CustomEvent("correct_answer");
    }

    public static void WrongAnswer()
    {
        Analytics.CustomEvent("wrong_answer");
    }

    // =========================
    // ACHIEVEMENTS
    // =========================

    public static void AchievementUnlocked(string achievementId, string title)
    {
        Analytics.CustomEvent("achievement_unlocked",
            new Dictionary<string, object>
            {
                { "achievementId", achievementId },
                { "title", title }
            });
    }

    // =========================
    // INVENTORY
    // =========================

    public static void ItemUnlocked(string itemId, string itemName)
    {
        Analytics.CustomEvent("item_unlocked",
            new Dictionary<string, object>
            {
                { "itemId", itemId },
                { "itemName", itemName }
            });
    }

    public static void ItemEquipped(string itemId)
    {
        Analytics.CustomEvent("item_equipped",
            new Dictionary<string, object>
            {
                { "itemId", itemId }
            });
    }

    // =========================
    // PROGRESSION (xp, points, level, streak, hints)
    // =========================

    public static void XpGained(int amount)
    {
        Analytics.CustomEvent("xp_gained",
            new Dictionary<string, object>
            {
                { "amount", amount }
            });
    }

    public static void PointsGained(int amount)
    {
        Analytics.CustomEvent("points_gained",
            new Dictionary<string, object>
            {
                { "amount", amount }
            });
    }

    public static void LevelUp(int newLevel)
    {
        Analytics.CustomEvent("level_up",
            new Dictionary<string, object>
            {
                { "level", newLevel }
            });
    }

    public static void StreakUpdated(int streak)
    {
        Analytics.CustomEvent("streak_updated",
            new Dictionary<string, object>
            {
                { "streak", streak }
            });
    }

    public static void HintUsed(int hintsRemaining)
    {
        Analytics.CustomEvent("hint_used",
            new Dictionary<string, object>
            {
                { "hintsRemaining", hintsRemaining }
            });
    }

    // =========================
    // SETTINGS
    // =========================

    public static void ChangedGraphics(string quality)
    {
        Analytics.CustomEvent("graphics_changed",
            new Dictionary<string, object>
            {
                { "quality", quality }
            });
    }

    public static void ChangedResolution(string resolution)
    {
        Analytics.CustomEvent("resolution_changed",
            new Dictionary<string, object>
            {
                { "resolution", resolution }
            });
    }

    public static void VolumeChanged(float volume)
    {
        Analytics.CustomEvent("volume_changed",
            new Dictionary<string, object>
            {
                { "volume", volume }
            });
    }

    // =========================
    // TIME
    // =========================

    public static void TimeSpent(string lessonId, float seconds)
    {
        Analytics.CustomEvent("time_spent",
            new Dictionary<string, object>
            {
                { "lessonId", lessonId },
                { "seconds", seconds }
            });
    }
}