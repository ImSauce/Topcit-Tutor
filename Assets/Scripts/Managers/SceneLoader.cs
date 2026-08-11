using UnityEngine;
using UnityEngine.SceneManagement;

#if UNITY_EDITOR
using UnityEditor;
#endif

public class SceneLoader : MonoBehaviour
{
    [System.Serializable]
    public class SceneEntry
    {
#if UNITY_EDITOR
        public SceneAsset sceneAsset;
#endif
        // Auto-filled from sceneAsset in the editor, used at runtime (builds don't have SceneAsset)
        [HideInInspector] public string sceneName;
    }

    [Header("Scenes")]
    [Tooltip("Add every scene you want to be able to load here.")]
    public SceneEntry[] scenes;

    [Header("Default")]
    [Tooltip("Index used when calling the no-argument LoadScene().")]
    public int defaultIndex = 0;

    private void OnValidate()
    {
#if UNITY_EDITOR
        // Keep sceneName in sync with the assigned SceneAsset whenever it changes in the inspector.
        if (scenes == null) return;

        foreach (var entry in scenes)
        {
            if (entry.sceneAsset != null)
            {
                entry.sceneName = entry.sceneAsset.name;
            }
        }
#endif
    }

    /// <summary>
    /// Loads the scene at defaultIndex. Kept for backward compatibility with
    /// existing UnityEvent hookups (e.g. Button OnClick) that call LoadScene() with no args.
    /// </summary>
    public void LoadScene()
    {
        LoadScene(defaultIndex);
    }

    /// <summary>
    /// Loads a scene by its index in the scenes array.
    /// You can wire this directly to a UI Button's OnClick (it supports a Dynamic int argument),
    /// which lets one SceneLoader serve buttons for multiple different scenes.
    /// </summary>
    public void LoadScene(int index)
    {
        if (scenes == null || index < 0 || index >= scenes.Length)
        {
            Debug.LogWarning($"SceneLoader: index {index} is out of range.");
            return;
        }

        LoadSceneInternal(scenes[index]);
    }

    /// <summary>
    /// Loads a scene by name, matching against the names in the scenes array.
    /// </summary>
    public void LoadScene(string sceneNameToLoad)
    {
        if (scenes == null)
        {
            Debug.LogWarning("SceneLoader: no scenes assigned.");
            return;
        }

        foreach (var entry in scenes)
        {
            if (entry.sceneName == sceneNameToLoad)
            {
                LoadSceneInternal(entry);
                return;
            }
        }

        Debug.LogWarning($"SceneLoader: no scene named \"{sceneNameToLoad}\" found in the scenes array.");
    }

    private void LoadSceneInternal(SceneEntry entry)
    {
        if (entry == null || string.IsNullOrEmpty(entry.sceneName))
        {
            Debug.LogWarning("SceneLoader: this scene entry has no scene assigned.");
            return;
        }

        SceneManager.LoadScene(entry.sceneName);
    }
}