using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

#if UNITY_EDITOR
using UnityEditor;
#endif

/// <summary>
/// Holds a list of scenes you can pick from in the Inspector, and loads
/// whichever one you choose - by index (for wiring to a Button's OnClick)
/// or by name (if you'd rather pass a string).
///
/// SETUP:
/// 1. Put this script on any GameObject (e.g. an empty "SceneLoader" object,
///    or directly on your menu Canvas).
/// 2. In the Inspector, expand "Scenes" and add one entry per scene you
///    want available, dragging the actual Scene asset into each slot.
/// 3. On your Button, add an OnClick event, drag in the GameObject holding
///    this script, and pick SceneLoader -> LoadSceneByIndex (the dynamic
///    int version). Type in the index number of the scene you want -
///    the custom Inspector below the scene list shows you exactly which
///    number belongs to which scene.
///
/// IMPORTANT: every scene you want to load must also be added to
/// File > Build Settings > Scenes In Build, or SceneManager.LoadScene
/// will fail to find it by name once the project is built.
/// </summary>
public class SceneLoader : MonoBehaviour
{
    /// <summary>
    /// One entry in the scene list. We store the actual SceneAsset only in
    /// the editor (that type doesn't exist in a build), but we cache its
    /// name into a plain string every time it changes - that string DOES
    /// survive into the build and is what actually gets used to load.
    /// </summary>
    [System.Serializable]
    public class SceneEntry
    {
#if UNITY_EDITOR
        [Tooltip("Drag the Scene asset here.")]
        public SceneAsset sceneAsset;
#endif

        // Auto-filled from sceneAsset's name whenever it changes in the Inspector.
        // This is what SceneManager actually uses at runtime.
        [HideInInspector] public string sceneName;
    }

    [Header("Scenes")]
    [Tooltip("Add one entry per scene you want this loader to be able to open. The index of each entry (shown in the box below) is what you type into a Button's OnClick(int) field.")]
    public List<SceneEntry> scenes = new List<SceneEntry>();

    private void OnValidate()
    {
        // Runs automatically in the editor whenever you change something in
        // the Inspector - this is what keeps sceneName in sync with whatever
        // SceneAsset you dragged in, without you having to do it manually.
#if UNITY_EDITOR
        foreach (SceneEntry entry in scenes)
        {
            entry.sceneName = entry.sceneAsset != null ? entry.sceneAsset.name : string.Empty;
        }
#endif
    }

    /// <summary>
    /// Loads a scene by its position in the "scenes" list. This is the one
    /// you hook up to a Button's OnClick - Unity will show it as a field
    /// that takes a single int, which is the index to load.
    /// </summary>
    public void LoadSceneByIndex(int index)
    {
        if (index < 0 || index >= scenes.Count)
        {
            Debug.LogWarning($"SceneLoader: index {index} is out of range (0 to {scenes.Count - 1}).");
            return;
        }

        string targetScene = scenes[index].sceneName;

        if (string.IsNullOrEmpty(targetScene))
        {
            Debug.LogWarning($"SceneLoader: entry at index {index} has no scene assigned.");
            return;
        }

        SceneManager.LoadScene(targetScene);
    }

    /// <summary>
    /// Loads a scene by exact name instead of index. Useful if you'd rather
    /// type the scene name directly into a Button's OnClick(string) field,
    /// or call this from other code without needing to know list order.
    /// </summary>
    public void LoadSceneByName(string sceneName)
    {
        if (string.IsNullOrEmpty(sceneName))
        {
            Debug.LogWarning("SceneLoader: no scene name was provided.");
            return;
        }

        SceneManager.LoadScene(sceneName);
    }
}