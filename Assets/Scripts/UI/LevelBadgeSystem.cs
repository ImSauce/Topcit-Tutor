// using System;
// using System.Collections.Generic;
// using Firebase.Auth;
// using Firebase.Firestore;
// using TMPro;
// using UnityEngine;
// using UnityEngine.UI;

// public class LevelBadgeSystem : MonoBehaviour
// {
//     [Serializable]
//     public class Badge
//     {
//         [Tooltip("Minimum level required to use this badge.")]
//         public int requiredLevel;

//         [Tooltip("Image displayed when the player reaches this level.")]
//         public Sprite badgeImage;
//     }

//     [Header("Badge UI")]
//     public Image badgeImageUI;

//     [Header("Badges")]
//     [Tooltip("Add badges in the Inspector. The highest unlocked level will be used.")]
//     public Badge[] badges;

//     [Header("Optional")]
//     [Tooltip("Automatically update the badge when the scene starts.")]
//     public bool updateOnStart = true;

//     private string userId;


//     private async void Start()
//     {
//         if (!updateOnStart)
//             return;

//         FirebaseUser user = FirebaseManager.Instance.Auth.CurrentUser;

//         if (user == null)
//         {
//             Debug.LogError("LevelBadgeSystem: No user is logged in.");
//             return;
//         }

//         userId = user.UserId;

//         // Get player data from Firestore
//         DocumentSnapshot userData =
//             await FirestoreManager.Instance.GetUser(userId);

//         if (userData == null)
//         {
//             Debug.LogError("LevelBadgeSystem: Player data not found.");
//             return;
//         }

//         long currentLevel = userData.GetValue<long>("level");

//         UpdateBadge((int)currentLevel);
//     }


//     /// <summary>
//     /// Updates the badge based on the player's level.
//     /// Can also be called manually from other scripts.
//     /// </summary>
//     public void UpdateBadge(int playerLevel)
//     {
//         if (badgeImageUI == null)
//         {
//             Debug.LogError("LevelBadgeSystem: Badge Image UI is not assigned.");
//             return;
//         }

//         if (badges == null || badges.Length == 0)
//         {
//             Debug.LogWarning("LevelBadgeSystem: No badges have been assigned.");
//             return;
//         }

//         Badge selectedBadge = null;

//         // Find the highest-level badge the player has unlocked.
//         foreach (Badge badge in badges)
//         {
//             if (badge.badgeImage == null)
//                 continue;

//             if (playerLevel >= badge.requiredLevel)
//             {
//                 if (selectedBadge == null ||
//                     badge.requiredLevel > selectedBadge.requiredLevel)
//                 {
//                     selectedBadge = badge;
//                 }
//             }
//         }

//         // Apply the badge
//         if (selectedBadge != null)
//         {
//             badgeImageUI.sprite = selectedBadge.badgeImage;
//             badgeImageUI.enabled = true;

//             Debug.Log(
//                 $"Badge updated: Level {playerLevel} → Required Level {selectedBadge.requiredLevel}"
//             );
//         }
//         else
//         {
//             // No badge has been unlocked yet.
//             badgeImageUI.enabled = false;

//             Debug.Log($"No badge unlocked at level {playerLevel}.");
//         }
//     }
// }