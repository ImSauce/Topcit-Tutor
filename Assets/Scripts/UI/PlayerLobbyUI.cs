using Firebase.Auth;
using Firebase.Firestore;
using TMPro;
using UnityEngine;
using System.Threading.Tasks;

public class PlayerLobbyUI : MonoBehaviour
{
    [Header("UI")]
    public TMP_Text usernameText;
    public TMP_Text levelText;
    public TMP_Text pointsText;
    public TMP_Text streakText;

    [Header("UI (optional)")]
    [Tooltip("Leave empty if you don't want to show lifetime XP anywhere in the lobby.")]
    public TMP_Text totalXpText;

    private string userId;

    private async void Start()
    {
        await LoadPlayerData();
    }

    // =========================================================
    // LOAD PLAYER DATA
    // =========================================================

    private async Task LoadPlayerData()
    {
        FirebaseUser user = FirebaseManager.Instance.Auth.CurrentUser;

        if (user == null)
        {
            Debug.LogError("No user is logged in.");

            if (usernameText != null)
                usernameText.text = "Not logged in";

            return;
        }

        userId = user.UserId;

        // Username comes from Firebase Auth
        if (usernameText != null)
            usernameText.text = user.DisplayName;

        // Get player data from Firestore
        DocumentSnapshot playerData =
            await FirestoreManager.Instance.GetUser(userId);

        if (playerData == null)
        {
            Debug.LogError("Player data not found in Firestore.");
            return;
        }

        UpdateUI(playerData);
    }

    // =========================================================
    // REFRESH PLAYER DATA
    // =========================================================

    public async void RefreshPlayerData()
    {
        if (string.IsNullOrEmpty(userId))
        {
            Debug.LogWarning("Player data has not been loaded yet.");
            return;
        }

        DocumentSnapshot playerData =
            await FirestoreManager.Instance.GetUser(userId);

        if (playerData == null)
        {
            Debug.LogError("Player data not found in Firestore.");
            return;
        }

        UpdateUI(playerData);
    }

    // =========================================================
    // UPDATE UI
    // =========================================================

    private void UpdateUI(DocumentSnapshot playerData)
    {
        long level = playerData.GetValue<long>("level");
        long points = playerData.GetValue<long>("points");
        long streak = playerData.GetValue<long>("streak");

        if (levelText != null)
            levelText.text = $"{level}";

        if (pointsText != null)
            pointsText.text = $"{points}";

        if (streakText != null)
            streakText.text = $"{streak}";

        // ContainsField check because older test accounts made before totalXp
        // existed won't have it yet - GetValue<T> throws on a missing field.
        if (totalXpText != null)
        {
            long totalXp = playerData.ContainsField("totalXp") ? playerData.GetValue<long>("totalXp") : 0;
            totalXpText.text = $"{totalXp}";
        }
    }
}