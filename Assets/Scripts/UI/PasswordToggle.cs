using TMPro;
using UnityEngine;
using UnityEngine.UI;

///----------------------------------------------------------------------------------------------
/// WHAT THIS SCRIPT DOES (in plain English):
///
/// This lets the player click a button to reveal or re-hide the text in a
/// password box. It also swaps the button's picture (icon) so it matches
/// whatever state the password is currently in.
///
/// Example: password is hidden (shows dots) -> button shows a closed eye icon.
/// Player clicks it -> password becomes visible (shows real letters) -> button
/// switches to an open eye icon.
///
/// SETUP NEEDED:
/// - Put this script on your toggle button itself (or any GameObject you like).
/// - Drag the password TMP_InputField into "Password Field".
/// - Drag the button's own Image component into "Toggle Button Icon".
/// - Drag in two sprites: one that looks like "hidden" (closed eye / crossed
///   out eye) and one that looks like "visible" (open eye).
/// - On your button's OnClick, drag this script's GameObject in and pick
///   TogglePasswordVisibility().
///----------------------------------------------------------------------------------------------
public class PasswordToggle : MonoBehaviour
{
    [Header("The password box this button controls")]
    public TMP_InputField passwordField;

    [Header("The button's own icon image, which will change pictures")]
    public Image toggleButtonIcon;

    [Header("Icons to swap between")]
    public Sprite hiddenIcon;  // shown while the password is hidden (dots)
    public Sprite visibleIcon; // shown while the password is visible (real text)

    // Keeps track of whether the password is currently shown or hidden.
    // Starts as "false" because password fields are hidden by default.
    private bool isPasswordVisible = false;

    /// <summary>
    /// Call this from the toggle button's OnClick.
    /// Flips the password between hidden and visible, and updates the icon to match.
    /// </summary>
    public void TogglePasswordVisibility()
    {
        // Flip true to false, or false to true.
        isPasswordVisible = !isPasswordVisible;

        if (isPasswordVisible)
        {
            // "Standard" means normal, readable text - no hiding.
            passwordField.contentType = TMP_InputField.ContentType.Standard;
        }
        else
        {
            // "Password" means Unity shows dots/asterisks instead of real letters.
            passwordField.contentType = TMP_InputField.ContentType.Password;
        }

        // Changing contentType alone doesn't instantly redraw the text on screen -
        // this line forces the input field to refresh right now, so the change
        // is visible immediately instead of only after the player types again.
        passwordField.ForceLabelUpdate();

        UpdateIcon();
    }

    /// <summary>Swaps the button's picture to match the current state.</summary>
    private void UpdateIcon()
    {
        if (toggleButtonIcon == null) return;

        toggleButtonIcon.sprite = isPasswordVisible ? visibleIcon : hiddenIcon;
    }
}