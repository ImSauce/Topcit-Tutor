using Firebase.Auth;
using Firebase.Firestore;
using TMPro;
using UnityEngine;

public class PlayerLobbyUI : MonoBehaviour
{
    public TMP_Text usernameText;
    public TMP_Text levelText;
    public TMP_Text pointsText;
    public TMP_Text streakText;

    private async void Update()
    {
        FirebaseUser user = FirebaseManager.Instance.Auth.CurrentUser;

        if (user == null)
        {
            usernameText.text = "Not logged in";
            return;
        }

        // Username comes from Firebase Auth
        usernameText.text = user.DisplayName;

        // Get the player's Firestore document
        DocumentSnapshot playerData =
            await FirestoreManager.Instance.GetUser(user.UserId);

        if (playerData == null)
        {
            Debug.LogError("Player data not found in Firestore.");
            return;
        }

        // Get values from Firestore
        long level = playerData.GetValue<long>("level");
        long points = playerData.GetValue<long>("points");
        long streak = playerData.GetValue<long>("streak");

        // Put them into the UI
        levelText.text = $"{level}";
        pointsText.text = $"{points}";
        streakText.text = $"{streak}";
    }

    public async void RefreshPlayerData()
    {
        FirebaseUser user = FirebaseManager.Instance.Auth.CurrentUser;

        if (user == null)
            return;

        DocumentSnapshot playerData =
            await FirestoreManager.Instance.GetUser(user.UserId);

        if (playerData == null)
            return;

        long level = playerData.GetValue<long>("level");
        long points = playerData.GetValue<long>("points");
        long streak = playerData.GetValue<long>("streak");

        levelText.text = $"{level}";
        pointsText.text = $"{points}";
        streakText.text = $"{streak}";
    }
}