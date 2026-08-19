using Firebase.Auth;
using Firebase.Firestore;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class XPBar : MonoBehaviour
{
    [Header("XP Slider")]
    public Slider xpSlider;

    [Header("XP Text")]
    public TMP_Text xpText;

    private long currentXP;
    private long currentLevel;
    private long currentTotalXp;
    private long currentXpCap;

    private string userId;
    private bool dataLoaded = false;

    private async void Start()
    {
        await LoadPlayerXP();
    }

    // =========================================================
    // LOAD PLAYER DATA
    // =========================================================

    private async System.Threading.Tasks.Task LoadPlayerXP()
    {
        FirebaseUser user = FirebaseManager.Instance.Auth.CurrentUser;

        if (user == null)
        {
            Debug.LogError("No user is logged in.");
            return;
        }

        userId = user.UserId;

        DocumentSnapshot userData =
            await FirestoreManager.Instance.GetUser(userId);

        if (userData == null)
        {
            Debug.LogError("Player data not found in Firestore.");
            return;
        }

        // ContainsField checks matter here - older test accounts made before
        // totalXp existed won't have that field yet, and GetValue<T> throws
        // if the field is missing rather than just returning a default.
        currentXP = userData.ContainsField("xp") ? userData.GetValue<long>("xp") : 0;
        currentLevel = userData.ContainsField("level") ? userData.GetValue<long>("level") : 1;
        currentTotalXp = userData.ContainsField("totalXp") ? userData.GetValue<long>("totalXp") : 0;

        // Self-heal: if this account has leftover xp sitting over its level's
        // cap (from before this fix existed), correct it now and save the fix.
        var (healedLevel, healedXp) = LevelingRules.ApplyXpGain(currentLevel, currentXP, 0);
        if (healedLevel != currentLevel || healedXp != currentXP)
        {
            Debug.Log($"Correcting stale over-cap XP: {currentLevel}/{currentXP} -> {healedLevel}/{healedXp}");
            currentLevel = healedLevel;
            currentXP = healedXp;

            await FirestoreManager.Instance.UpdateFields($"Users/{userId}", new Dictionary<string, object>
            {
                { "xp", currentXP },
                { "level", currentLevel }
            });
        }

        currentXpCap = LevelingRules.GetXpCapForLevel(currentLevel);

        UpdateSlider();

        dataLoaded = true;

        Debug.Log($"XP Loaded: {currentXP}/{currentXpCap} | Level: {currentLevel} | Total XP: {currentTotalXp}");
    }

    // =========================================================
    // ADD XP
    // =========================================================

    /// <summary>
    /// Grants XP through FirestoreManager.GrantXp, which does a fresh
    /// read-modify-write against Firestore (not just this component's cached
    /// values) - so it stays correct even if XP was also granted from a
    /// different scene (e.g. a lesson-complete button) since this bar last loaded.
    /// </summary>
    public async void AddXP(long amount)
    {
        if (amount <= 0)
        {
            Debug.LogWarning("XP amount must be greater than 0.");
            return;
        }

        if (!dataLoaded)
        {
            Debug.LogWarning("XP data hasn't finished loading yet.");
            return;
        }

        if (string.IsNullOrEmpty(userId))
        {
            Debug.LogError("User ID is missing.");
            return;
        }

        XpGrantResult result = await FirestoreManager.Instance.GrantXp(userId, amount);

        if (!result.Success)
        {
            Debug.LogError("Failed to save XP and level.");
            return;
        }

        currentXP = result.NewXp;
        currentLevel = result.NewLevel;
        currentTotalXp = result.NewTotalXp;
        currentXpCap = LevelingRules.GetXpCapForLevel(currentLevel);

        UpdateSlider();

        Debug.Log(
            $"XP Added: +{amount} | " +
            $"Current XP: {currentXP}/{currentXpCap} | " +
            $"Level: {currentLevel} | " +
            $"Total XP: {currentTotalXp}"
        );
    }

    // =========================================================
    // SLIDER
    // =========================================================

    private void UpdateSlider()
    {
        if (xpSlider == null)
        {
            Debug.LogError("XP Slider is not assigned!");
            return;
        }

        if (xpText == null)
        {
            Debug.LogError("XP Text is not assigned!");
            return;
        }

        xpSlider.minValue = 0;
        xpSlider.maxValue = currentXpCap;
        xpSlider.value = currentXP;

        xpText.text = $"{currentXP}/{currentXpCap}";
    }

    // =========================================================
    // REFRESH
    // =========================================================

    public async void RefreshPlayerData()
    {
        await LoadPlayerXP();
    }

    // =========================================================
    // TEST
    // =========================================================

    public void Add10XP()
    {
        AddXP(10);
    }
}