using System;
using Firebase;
using Firebase.Auth;
using UnityEngine;

///----------------------------------------------------------------------------------------------
/// Single entry point for Firebase setup. Initializes Firebase once, then
/// exposes the ready-to-use FirebaseAuth instance to any script that needs it.
///
/// Attach this to one persistent GameObject (e.g. a "Managers" object in your
/// first scene) and mark it DontDestroyOnLoad, or drop it into a bootstrap scene.
///----------------------------------------------------------------------------------------------
public class FirebaseManager : MonoBehaviour
{
    public static FirebaseManager Instance { get; private set; }

    public FirebaseAuth Auth { get; private set; }
    public DependencyStatus DependencyStatus { get; private set; }

    /// True once Firebase has finished initializing successfully.
    public bool IsReady { get; private set; }

    /// Fires once, after Firebase finishes initializing successfully.
    public event Action OnFirebaseReady;

    /// Fires if Firebase dependencies fail to resolve. Passes the failure status.
    public event Action<DependencyStatus> OnFirebaseInitFailed;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);

        InitializeFirebaseAsync();
    }

    private async void InitializeFirebaseAsync()
    {
        DependencyStatus = await FirebaseApp.CheckAndFixDependenciesAsync();

        if (DependencyStatus == DependencyStatus.Available)
        {
            Auth = FirebaseAuth.DefaultInstance;
            IsReady = true;
            Debug.Log("Firebase initialized successfully.");
            OnFirebaseReady?.Invoke();
        }
        else
        {
            Debug.LogError($"Could not resolve Firebase dependencies: {DependencyStatus}");
            OnFirebaseInitFailed?.Invoke(DependencyStatus);
        }
    }
}