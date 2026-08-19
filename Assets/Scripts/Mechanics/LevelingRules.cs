///----------------------------------------------------------------------------------------------
/// WHAT THIS SCRIPT DOES (in plain English):
///
/// This is pure math - it doesn't touch Firebase or Unity UI at all. It's the ONE
/// place that knows "how big is the XP bar at level N" and "what happens when a
/// reward pushes you past the cap". Both XPBar.cs (the UI) and
/// FirestoreManager.cs (button-triggered XP grants) call into this, so the two
/// can never drift out of sync with each other - that drift is what was causing
/// XP to go over the cap without the level updating. If you ever want to change
/// how fast players level up, you only need to change the two numbers below.
///----------------------------------------------------------------------------------------------
public static class LevelingRules
{
    public const long StartingXpCap = 50;
    public const long XpIncreasePerLevel = 10;

    /// How much XP is needed to finish the given level's bar.
    public static long GetXpCapForLevel(long level)
    {
        return StartingXpCap + ((level - 1) * XpIncreasePerLevel);
    }

    /// <summary>
    /// Adds xpToAdd to currentXp starting at currentLevel, rolling over into as
    /// many level-ups as needed in one go - so a big reward (say, +200 XP when
    /// the cap is 50) correctly jumps several levels instead of leaving the XP
    /// value stuck above the cap with no level-up applied.
    /// </summary>
    public static (long newLevel, long newXp) ApplyXpGain(long currentLevel, long currentXp, long xpToAdd)
    {
        long level = currentLevel < 1 ? 1 : currentLevel;
        long xp = currentXp + xpToAdd;
        long cap = GetXpCapForLevel(level);

        while (xp >= cap)
        {
            xp -= cap;
            level++;
            cap = GetXpCapForLevel(level);
        }

        return (level, xp);
    }
}