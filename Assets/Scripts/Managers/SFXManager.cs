using UnityEngine;

public class SFXManager : MonoBehaviour
{
    public static SFXManager Instance { get; private set; }

    [Header("SFX")]
    [SerializeField] private AudioClip[] sfxClips;

    [Header("Audio")]
    [SerializeField, Range(0f, 1f)] private float volume = 1f;

    private AudioSource audioSource;

    public float Volume
    {
        get => volume;
        private set
        {
            volume = Mathf.Clamp01(value);
            audioSource.volume = volume;
        }
    }

    private void Awake()
    {
        // Prevent duplicate SFXManagers between scenes.
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);

        audioSource = GetComponent<AudioSource>();

        if (audioSource == null)
            audioSource = gameObject.AddComponent<AudioSource>();

        audioSource.playOnAwake = false;
        audioSource.volume = volume;
    }

    public void PlaySFX(int index)
    {
        if (sfxClips == null || sfxClips.Length == 0)
        {
            Debug.LogWarning("SFXManager: No SFX clips assigned.");
            return;
        }

        if (index < 0 || index >= sfxClips.Length)
        {
            Debug.LogWarning($"SFXManager: Invalid SFX index {index}.");
            return;
        }

        if (sfxClips[index] == null)
        {
            Debug.LogWarning($"SFXManager: SFX clip {index} is empty.");
            return;
        }

        audioSource.PlayOneShot(sfxClips[index], volume);
    }

    public void SetVolume(float newVolume)
    {
        Volume = newVolume;
    }

    public void SetVolumePercent(float percent)
    {
        SetVolume(percent / 100f);
    }

    public void StopAllSFX()
    {
        audioSource.Stop();
    }
}