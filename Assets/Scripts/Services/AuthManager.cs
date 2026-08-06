using Firebase.Auth;
using Firebase.Extensions;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
///----------------------------------------------------------------------------------------------
/// Handles login and registration UI logic. Assumes FirebaseManager has
/// already initialized Firebase (or is in the process of doing so).
/// Needs an AuthManager gameobject in the scene with this script attached, and the UI elements assigned.
///----------------------------------------------------------------------------------------------
public class AuthManager : MonoBehaviour
{
    [Header("Login")]
    public TMP_InputField emailLoginField;
    public TMP_InputField passwordLoginField;
    public TMP_Text warningLoginText;
    public TMP_Text confirmLoginText;
    public Button loginButton;

    [Header("Register")]
    public TMP_InputField usernameRegisterField;
    public TMP_InputField emailRegisterField;
    public TMP_InputField passwordRegisterField;
    public TMP_InputField passwordRegisterVerifyField;
    public TMP_Text warningRegisterText;
    public Button registerButton;

    private FirebaseAuth Auth => FirebaseManager.Instance.Auth;

    // ---------- Button hooks ----------

    public async void LoginButtonClicked()
    {
        SetLoginBusy(true);
        await Login(emailLoginField.text, passwordLoginField.text);
        SetLoginBusy(false);
    }

    public async void RegisterButtonClicked()
    {
        SetRegisterBusy(true);
        await Register(
            emailRegisterField.text,
            passwordRegisterField.text,
            passwordRegisterVerifyField.text,
            usernameRegisterField.text);
        SetRegisterBusy(false);
    }

    // ---------- Core logic ----------

    private async System.Threading.Tasks.Task Login(string email, string password)
    {
        warningLoginText.text = "";

        var result = await Auth.SignInWithEmailAndPasswordAsync(email, password)
            .ContinueWithOnMainThread(task => task);

        if (result.IsFaulted || result.IsCanceled)
        {
            warningLoginText.text = FirebaseErrors.GetMessage(result.Exception, "Login failed.");
            return;
        }

        FirebaseUser user = result.Result.User;
        Debug.Log($"User signed in: {user.DisplayName} ({user.Email})");
        confirmLoginText.text = "Logged In";
    }

    private async System.Threading.Tasks.Task Register(
        string email, string password, string passwordVerify, string username)
    {
        warningRegisterText.text = "";

        if (string.IsNullOrWhiteSpace(username))
        {
            warningRegisterText.text = "Missing Username";
            return;
        }

        if (password != passwordVerify)
        {
            warningRegisterText.text = "Passwords Do Not Match";
            return;
        }

        var createResult = await Auth.CreateUserWithEmailAndPasswordAsync(email, password)
            .ContinueWithOnMainThread(task => task);

        if (createResult.IsFaulted || createResult.IsCanceled)
        {
            warningRegisterText.text = FirebaseErrors.GetMessage(createResult.Exception, "Registration failed.");
            return;
        }

        FirebaseUser newUser = createResult.Result.User;
        if (newUser == null) return;

        var profile = new UserProfile { DisplayName = username };
        var profileResult = await newUser.UpdateUserProfileAsync(profile)
            .ContinueWithOnMainThread(task => task);

        if (profileResult.IsFaulted || profileResult.IsCanceled)
        {
            warningRegisterText.text = "Account created, but setting username failed.";
            return;
        }

        UIManager.instance.LoginScreen();
    }

    // ---------- UI helpers ----------

    private void SetLoginBusy(bool busy)
    {
        if (loginButton != null) loginButton.interactable = !busy;
    }

    private void SetRegisterBusy(bool busy)
    {
        if (registerButton != null) registerButton.interactable = !busy;
    }
}