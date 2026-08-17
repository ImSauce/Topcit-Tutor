using System.Collections;
using UnityEngine;

public class SceneTransition : MonoBehaviour
{
    [Header("Fade In / Start")]
    [Tooltip("GameObject containing the Fade In Animator.")]
    public GameObject startTransitionObject;

    [Tooltip("Name of the Fade In animation.")]
    public string startAnimation = "Enter_Transition";

    [Tooltip("How long the Fade In animation lasts.")]
    public float startAnimationLength = 1f;


    [Header("Fade Out / Exit")]
    [Tooltip("GameObject containing the Fade Out Animator.")]
    public GameObject exitTransitionObject;

    [Tooltip("Name of the Fade Out animation.")]
    public string exitAnimation = "Exit_Transition";

    [Tooltip("How long the Fade Out animation lasts.")]
    public float exitAnimationLength = 1f;


    [Header("Scene Loader")]
    public SceneLoader sceneLoader;


    private Animator startAnimator;
    private Animator exitAnimator;

    private bool isTransitioning = false;


    private void Awake()
    {
        // Get Fade In Animator
        if (startTransitionObject != null)
        {
            startAnimator = startTransitionObject.GetComponent<Animator>();

            if (startAnimator == null)
            {
                Debug.LogError(
                    "SceneTransition: Start Transition Object does not have an Animator."
                );
            }
        }

        // Get Fade Out Animator
        if (exitTransitionObject != null)
        {
            exitAnimator = exitTransitionObject.GetComponent<Animator>();

            if (exitAnimator == null)
            {
                Debug.LogError(
                    "SceneTransition: Exit Transition Object does not have an Animator."
                );
            }
        }
    }


    private void Start()
    {
        PlayFadeIn();
    }


    // ---------------------------------------------------------
    // FADE IN
    // ---------------------------------------------------------

    private void PlayFadeIn()
    {
        if (startTransitionObject == null || startAnimator == null)
            return;

        // Make sure the Fade In object is visible
        startTransitionObject.SetActive(true);

        // Play Fade In animation
        startAnimator.Play(startAnimation, 0, 0f);

        // Disable it after the animation finishes
        StartCoroutine(DisableStartTransition());
    }


    private IEnumerator DisableStartTransition()
    {
        yield return new WaitForSeconds(startAnimationLength);

        if (startTransitionObject != null)
            startTransitionObject.SetActive(false);
    }


    // ---------------------------------------------------------
    // TRANSITION TO DEFAULT SCENE
    // ---------------------------------------------------------

    public void Transition()
    {
        if (isTransitioning)
            return;

        StartCoroutine(TransitionRoutine());
    }


    private IEnumerator TransitionRoutine()
    {
        isTransitioning = true;

        // Play Fade Out
        yield return StartCoroutine(PlayFadeOut());

        // Tell SceneLoader to load its default scene
        if (sceneLoader != null)
        {
            sceneLoader.LoadScene();
        }
        else
        {
            Debug.LogError("SceneTransition: SceneLoader is not assigned.");
        }
    }


    // ---------------------------------------------------------
    // TRANSITION TO SPECIFIC SCENE
    // ---------------------------------------------------------

    public void TransitionToScene(int sceneIndex)
    {
        if (isTransitioning)
            return;

        StartCoroutine(TransitionToSceneRoutine(sceneIndex));
    }


    private IEnumerator TransitionToSceneRoutine(int sceneIndex)
    {
        isTransitioning = true;

        // Play Fade Out
        yield return StartCoroutine(PlayFadeOut());

        // Tell SceneLoader which scene to load
        if (sceneLoader != null)
        {
            sceneLoader.LoadScene(sceneIndex);
        }
        else
        {
            Debug.LogError("SceneTransition: SceneLoader is not assigned.");
        }
    }


    // ---------------------------------------------------------
    // FADE OUT
    // ---------------------------------------------------------

    private IEnumerator PlayFadeOut()
    {
        if (exitTransitionObject == null || exitAnimator == null)
        {
            Debug.LogWarning("SceneTransition: Exit Transition is not configured.");
            yield break;
        }

        // Enable Fade Out object
        exitTransitionObject.SetActive(true);

        // Play Fade Out animation
        exitAnimator.Play(exitAnimation, 0, 0f);

        // Wait until Fade Out finishes
        yield return new WaitForSeconds(exitAnimationLength);
    }
}