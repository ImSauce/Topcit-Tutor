using System;
using Firebase;
using Firebase.Auth;

///----------------------------------------------------------------------------------------------
/// Central place to turn a Firebase Auth exception into a human-readable message.
/// Used by both login and register so the mapping only lives in one spot.
/// called directly by AuthManager. this script doesnt need to be attached to a gameobject.
///----------------------------------------------------------------------------------------------
public static class FirebaseErrors
{
    public static string GetMessage(AggregateException exception, string fallback)
    {
        if (exception == null) return fallback;

        FirebaseException firebaseEx = exception.GetBaseException() as FirebaseException;
        if (firebaseEx == null) return fallback;

        AuthError errorCode = (AuthError)firebaseEx.ErrorCode;

        return errorCode switch
        {
            AuthError.MissingEmail => "Missing Email",
            AuthError.MissingPassword => "Missing Password",
            AuthError.WrongPassword => "Wrong Password",
            AuthError.InvalidEmail => "Invalid Email",
            AuthError.UserNotFound => "Account Does Not Exist",
            AuthError.WeakPassword => "Weak Password",
            AuthError.EmailAlreadyInUse => "Email Already In Use",
            AuthError.TooManyRequests => "Too Many Attempts, Try Again Later",
            AuthError.UserDisabled => "This Account Has Been Disabled",
            AuthError.NetworkRequestFailed => "Network Error, Check Your Connection",
            _ => fallback,
        };
    }
}