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

    [Header("XP Settings")]
    public long startingXpCap = 50;
    public long xpIncreasePerLevel = 10;

    [Header("XP Text")]
    public TMP_Text xpText;

    private long currentXP;
    private long currentLevel;
    private long currentXpCap;

    private string userId;

    private async void Start()
    {
        FirebaseUser user = FirebaseManager.Instance.Auth.CurrentUser;

        if (user == null)
        {
            Debug.LogError("No user is logged in.");
            return;
        }

        userId = user.UserId;

        // Get player's XP and level from Firestore
        DocumentSnapshot userData =
            await FirestoreManager.Instance.GetUser(userId);

        if (userData == null)
        {
            Debug.LogError("Player data not found in Firestore.");
            return;
        }

        currentXP = userData.GetValue<long>("xp");
        currentLevel = userData.GetValue<long>("level");

        CalculateXpCap();
        UpdateSlider();
    }

    // =========================================================
    // XP SYSTEM
    // =========================================================

    private void CalculateXpCap()
    {
        currentXpCap =
            startingXpCap +
            ((currentLevel - 1) * xpIncreasePerLevel);
    }

    /// <summary>
    /// Adds XP to the player.
    /// Handles level-ups and saves the result to Firestore.
    /// </summary>
    /// 
    public async void AddXP(long amount)
    {
        if (amount <= 0)
        {
            Debug.LogWarning("XP amount must be greater than 0.");
            return;
        }

        if (string.IsNullOrEmpty(userId))
        {
            Debug.LogError("User ID is missing.");
            return;
        }

        // Add XP
        currentXP += amount;

        // Handle level-ups
        while (currentXP >= currentXpCap)
        {
            currentXP -= currentXpCap;

            currentLevel++;

            CalculateXpCap();

            Debug.Log($"Level Up! New Level: {currentLevel}");
        }

        // Save XP and level to Firestore
        bool saved = await FirestoreManager.Instance.UpdateFields(
            $"Users/{userId}",
            new Dictionary<string, object>
            {
                { "xp", currentXP },
                { "level", currentLevel }
            }
        );

        if (!saved)
        {
            Debug.LogError("Failed to save XP and level.");
            return;
        }

        // Update the slider
        UpdateSlider();
    }

    // =========================================================
    // SLIDER
    // =========================================================

    private void UpdateSlider()
    {
        xpSlider.minValue = 0;
        xpSlider.maxValue = currentXpCap;
        xpSlider.value = currentXP;

        xpText.text = $"{currentXP}/{currentXpCap}";
    }



    public void Add10XP() // gfor testing purposes
    {
        AddXP(10);
    }


}