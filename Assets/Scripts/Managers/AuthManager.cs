using System.Collections.Generic;
using Firebase.Auth;
using Firebase.Extensions;
using Firebase.Firestore;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

///----------------------------------------------------------------------------------------------
/// WHAT THIS SCRIPT DOES (in plain English):
///
/// This script controls your Login screen and your Register (create account) screen.
/// It reads whatever the player typed into the email/password/username boxes,
/// sends that information to Firebase, and then shows a message telling the
/// player whether it worked or not.
///
/// NEW: When a brand new account is created, this script also builds a starter
/// "profile" for that player inside Firestore (your database) - things like
/// their level, points, XP, a starter achievement, and a starter subject.
///
/// SETUP NEEDED:
/// - Put this script on an "AuthManager" GameObject in your scene.
/// - Drag your actual UI text boxes, text labels, and buttons into the matching
///   slots that appear in the Inspector (explained field-by-field below).
///----------------------------------------------------------------------------------------------
public class AuthManager : MonoBehaviour
{
    [Header("Login")]
    // Where the player types their email to log in.
    public TMP_InputField emailLoginField;
    // Where the player types their password to log in.
    public TMP_InputField passwordLoginField;
    // A text label that shows an error message if login fails.
    // Example: this might say "Wrong Password" or "Account Does Not Exist".
    public TMP_Text warningLoginText;
    // A text label that shows a success message after logging in.
    // Example: this shows "Logged In" once it works.
    public TMP_Text confirmLoginText;
    // The actual Login button in your scene. We turn this on/off automatically
    // to stop the player from clicking it many times in a row while it's working.
    public Button loginButton;
    // A separate script that knows how to load the next scene (like your main menu).
    // We call this once login succeeds.
    public SceneLoader sceneLoader;
    public SceneTransition sceneTransition;

    [Header("Register")]
    // Where the player types the username they want.
    public TMP_InputField usernameRegisterField;
    // Where the player types their email to create an account.
    public TMP_InputField emailRegisterField;
    // Where the player types their chosen password.
    public TMP_InputField passwordRegisterField;
    // Where the player re-types their password, to make sure they didn't make a typo.
    public TMP_InputField passwordRegisterVerifyField;
    // A text label that shows an error message if registering fails.
    // Example: this might say "Missing Username" or "Email Already In Use".
    public TMP_Text warningRegisterText;
    // A text label that shows a success message after creating an account.
    // Example: this shows "Account created successfully!" once it works.
    public TMP_Text confirmRegisterText;
    // The actual Register button in your scene, same idea as loginButton above.
    public Button registerButton;

    // A shortcut so the rest of this script can just write "Auth" instead of
    // typing "FirebaseManager.Instance.Auth" every single time.
    private FirebaseAuth Auth => FirebaseManager.Instance.Auth;

    // Same idea, but for Firestore (the database that stores our player data).
    // If your FirebaseManager already has a Firestore reference, you can swap
    // this line for FirebaseManager.Instance.Db instead.
    private FirebaseFirestore Db => FirebaseFirestore.DefaultInstance;

    // =========================================================
    // BUTTON HOOKS
    // These are the two functions you connect to your buttons'
    // "On Click" events in the Unity Inspector.
    // =========================================================

    /// <summary>
    /// Call this from the Login button's OnClick.
    /// It disables the button, tries to log the player in, then re-enables
    /// the button again once it's done - whether it succeeded or failed.
    /// </summary>
    public async void LoginButtonClicked()
    {
        SetLoginBusy(true); // turn the button off so it can't be double-clicked

        try
        {
            await Login(emailLoginField.text, passwordLoginField.text);
        }
        finally
        {
            // "finally" is a special block that ALWAYS runs, no matter what
            // happened above it - even if something crashed unexpectedly.
            // This is what guarantees the button never gets stuck disabled forever.
            SetLoginBusy(false);
        }
    }

    /// <summary>
    /// Call this from the Register button's OnClick.
    /// Same idea as LoginButtonClicked, but for creating a new account.
    /// </summary>
    public async void RegisterButtonClicked()
    {
        SetRegisterBusy(true);

        try
        {
            await Register(
                emailRegisterField.text,
                passwordRegisterField.text,
                passwordRegisterVerifyField.text,
                usernameRegisterField.text);
        }
        finally
        {
            SetRegisterBusy(false);
        }
    }

    // =========================================================
    // CORE LOGIC
    // =========================================================

    /// <summary>
    /// Tries to log the player in using the email and password they typed.
    /// Example: Login("sam@email.com", "mypassword123")
    /// </summary>
    private async System.Threading.Tasks.Task Login(string email, string password)
    {
        warningLoginText.text = ""; // clear any old error message first

        // Ask Firebase to check the email/password. This is the part that
        // actually talks to the internet, so it takes a moment to finish.
        var result = await Auth.SignInWithEmailAndPasswordAsync(email, password)
            .ContinueWithOnMainThread(task => task);

        // If Firebase says something went wrong (wrong password, no such
        // account, etc), show a friendly message and stop here.
        if (result.IsFaulted || result.IsCanceled)
        {
            warningLoginText.text = FirebaseErrors.GetMessage(result.Exception, "Login failed.");
            return;
        }

        // If we reach this point, login worked!
        FirebaseUser user = result.Result.User;
        Debug.Log($"User signed in: {user.DisplayName} ({user.Email})");
        confirmLoginText.text = "Logged In";

        // Move the player on to the next scene (like your main menu).
        sceneTransition.Transition();
    }

    /// <summary>
    /// Tries to create a brand new account using the details the player typed.
    /// Example: Register("sam@email.com", "mypassword123", "mypassword123", "sam")
    /// </summary>
    private async System.Threading.Tasks.Task Register(
        string email, string password, string passwordVerify, string username)
    {
        warningRegisterText.text = "";  // clear any old error message
        confirmRegisterText.text = "";  // clear any old success message

        // Check the easy stuff first, before we even talk to Firebase.
        // This saves time and avoids unnecessary internet requests.

        if (string.IsNullOrWhiteSpace(username))
        {
            // Example: player left the username box completely empty.
            warningRegisterText.text = "Missing Username";
            return;
        }

        if (password != passwordVerify)
        {
            // Example: player typed "abc123" the first time and "abc124" the second time.
            warningRegisterText.text = "Passwords Do Not Match";
            return;
        }

        // Ask Firebase to create the account with this email and password.
        var createResult = await Auth.CreateUserWithEmailAndPasswordAsync(email, password)
            .ContinueWithOnMainThread(task => task);

        if (createResult.IsFaulted || createResult.IsCanceled)
        {
            // Example: this email is already used by another account.
            warningRegisterText.text = FirebaseErrors.GetMessage(createResult.Exception, "Registration failed.");
            return;
        }

        FirebaseUser newUser = createResult.Result.User;
        if (newUser == null) return; // safety check, should rarely happen

        // The account now exists, but it doesn't have the player's chosen
        // username attached yet - Firebase only knows the email so far.
        // This next part saves the username onto that new account.
        var profile = new UserProfile { DisplayName = username };
        var profileResult = await newUser.UpdateUserProfileAsync(profile)
            .ContinueWithOnMainThread(task => task);

        if (profileResult.IsFaulted || profileResult.IsCanceled)
        {
            // The account itself was created fine, just the username part failed.
            warningRegisterText.text = "Account created, but setting username failed.";
            return;
        }

        // The Auth account is fully set up now. Next, build that player's
        // starter data inside Firestore (level, points, achievements, etc).
        // All of that work lives in a separate script: NewUserDataInitializer.cs
        try
        {
            await NewUserDataInitializer.CreateNewUserData(Db, newUser.UserId, username);
        }
        catch (System.Exception e)
        {
            // The account itself is fine - only the starter data failed to save.
            // We still let the player through, but log this so you can check it.
            Debug.LogError($"Failed to create starter Firestore data: {e}");
            warningRegisterText.text = "Account created, but starter data failed to save.";
            return;
        }

        // Everything worked! Let the player know, and clear the form so
        // it's fresh and empty if they (or someone else) want to register again.
        confirmRegisterText.text = "Account created successfully!";
        ClearRegisterFields();
    }

    // =========================================================
    // SMALL HELPER FUNCTIONS
    // These are little reusable jobs the functions above rely on.
    // =========================================================

    /// <summary>
    /// Empties out all 4 register text boxes.
    /// Example: after this runs, usernameRegisterField.text becomes "" (empty).
    /// </summary>
    private void ClearRegisterFields()
    {
        usernameRegisterField.text = "";
        emailRegisterField.text = "";
        passwordRegisterField.text = "";
        passwordRegisterVerifyField.text = "";
    }

    /// <summary>
    /// Turns the Login button on or off.
    /// Example: SetLoginBusy(true) disables the button while we wait for Firebase.
    /// SetLoginBusy(false) turns it back on once we're done.
    /// </summary>
    private void SetLoginBusy(bool busy)
    {
        if (loginButton != null) loginButton.interactable = !busy;
    }

    /// <summary>
    /// Turns the Register button on or off, same idea as SetLoginBusy above.
    /// </summary>
    private void SetRegisterBusy(bool busy)
    {
        if (registerButton != null) registerButton.interactable = !busy;
    }
}