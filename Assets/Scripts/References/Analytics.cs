using UnityEngine;
using UnityEngine.Analytics;
using System.Collections.Generic;

public class AnalyticsManager : MonoBehaviour
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
    // LEVELS
    // =========================

    public static void LevelStarted(int level)
    {
        Analytics.CustomEvent("level_started",
            new Dictionary<string, object>
            {
                { "level", level }
            });
    }

    public static void LevelCompleted(int level)
    {
        Analytics.CustomEvent("level_completed",
            new Dictionary<string, object>
            {
                { "level", level }
            });
    }

    public static void LevelFailed(int level)
    {
        Analytics.CustomEvent("level_failed",
            new Dictionary<string, object>
            {
                { "level", level }
            });
    }

    // =========================
    // LESSONS
    // =========================

    public static void LessonStarted(string lessonName)
    {
        Analytics.CustomEvent("lesson_started",
            new Dictionary<string, object>
            {
                { "lesson", lessonName }
            });
    }

    public static void LessonCompleted(string lessonName)
    {
        Analytics.CustomEvent("lesson_completed",
            new Dictionary<string, object>
            {
                { "lesson", lessonName }
            });
    }

    // =========================
    // QUIZ
    // =========================

    public static void QuizStarted(string quiz)
    {
        Analytics.CustomEvent("quiz_started",
            new Dictionary<string, object>
            {
                { "quiz", quiz }
            });
    }

    public static void QuizCompleted(string quiz, int score)
    {
        Analytics.CustomEvent("quiz_completed",
            new Dictionary<string, object>
            {
                { "quiz", quiz },
                { "score", score }
            });
    }

    public static void QuizFailed(string quiz)
    {
        Analytics.CustomEvent("quiz_failed",
            new Dictionary<string, object>
            {
                { "quiz", quiz }
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
    // PLAYER
    // =========================

    public static void PlayerDied()
    {
        Analytics.CustomEvent("player_died");
    }

    public static void PlayerRespawned()
    {
        Analytics.CustomEvent("player_respawned");
    }

    public static void PlayerJumped()
    {
        Analytics.CustomEvent("player_jumped");
    }

    public static void GunFired()
    {
        Analytics.CustomEvent("gun_fired");
    }

    public static void Reload()
    {
        Analytics.CustomEvent("reload");
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
    // ACHIEVEMENTS
    // =========================

    public static void AchievementUnlocked(string achievement)
    {
        Analytics.CustomEvent("achievement_unlocked",
            new Dictionary<string, object>
            {
                { "achievement", achievement }
            });
    }

    // =========================
    // TIME
    // =========================

    public static void TimeSpent(string lesson, float seconds)
    {
        Analytics.CustomEvent("time_spent",
            new Dictionary<string, object>
            {
                { "lesson", lesson },
                { "seconds", seconds }
            });
    }


    
}


//Use Examples
// // =========================
// // GAME
// // =========================

// // Game starts
// AnalyticsManager.GameStarted();

// // Game closes
// AnalyticsManager.GameClosed();


// // =========================
// // LEVELS
// // =========================

// // Player enters Level 1
// AnalyticsManager.LevelStarted(1);

// // Player completes Level 1
// AnalyticsManager.LevelCompleted(1);

// // Player fails Level 1
// AnalyticsManager.LevelFailed(1);


// // =========================
// // LESSONS
// // =========================

// // Opens lesson
// AnalyticsManager.LessonStarted("Variables");

// // Completes lesson
// AnalyticsManager.LessonCompleted("Variables");


// // =========================
// // QUIZZES
// // =========================

// // Quiz begins
// AnalyticsManager.QuizStarted("Java Basics");

// // Quiz completed
// AnalyticsManager.QuizCompleted("Java Basics", 90);

// // Quiz failed
// AnalyticsManager.QuizFailed("Java Basics");


// // =========================
// // QUESTIONS
// // =========================

// // Correct answer
// AnalyticsManager.CorrectAnswer();

// // Wrong answer
// AnalyticsManager.WrongAnswer();


// // =========================
// // PLAYER
// // =========================

// // Player dies
// AnalyticsManager.PlayerDied();

// // Player respawns
// AnalyticsManager.PlayerRespawned();

// // Player jumps
// AnalyticsManager.PlayerJumped();

// // Gun fired
// AnalyticsManager.GunFired();

// // Reload weapon
// AnalyticsManager.Reload();


// // =========================
// // SETTINGS
// // =========================

// // Graphics quality changed
// AnalyticsManager.ChangedGraphics("Ultra");

// // Resolution changed
// AnalyticsManager.ChangedResolution("1920x1080");

// // Volume changed
// AnalyticsManager.VolumeChanged(0.75f);


// // =========================
// // MENU
// // =========================

// // Main menu opened
// AnalyticsManager.MainMenuOpened();

// // Settings menu opened
// AnalyticsManager.SettingsOpened();

// // Credits viewed
// AnalyticsManager.CreditsOpened();


// // =========================
// // ACCOUNT
// // =========================

// // User logged in
// AnalyticsManager.Login();

// // User registered
// AnalyticsManager.Register();

// // User logged out
// AnalyticsManager.Logout();


// // =========================
// // ACHIEVEMENTS
// // =========================

// // Achievement unlocked
// AnalyticsManager.AchievementUnlocked("First Quiz");


// // =========================
// // TIME
// // =========================

// // Player spent 132.5 seconds in lesson
// AnalyticsManager.TimeSpent("Variables", 132.5f);

