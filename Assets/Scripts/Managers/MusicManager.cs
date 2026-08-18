using UnityEngine;

public class MusicManager : MonoBehaviour
{
    public static MusicManager Instance { get; private set; }

    [Header("Music")]
    [SerializeField] private AudioClip[] musicTracks;

    [Tooltip("Automatically play all songs in order and restart from the beginning when the playlist ends.")]
    [SerializeField] private bool playPlaylist = true;

    [SerializeField] private int startingTrack = 0;

    [Header("Audio")]
    [SerializeField, Range(0f, 1f)] private float volume = 1f;

    private AudioSource audioSource;
    private int currentTrackIndex;

    public float Volume => volume;

    private void Awake()
    {
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
        audioSource.loop = !playPlaylist;
        audioSource.volume = volume;
    }

    private void Start()
    {
        if (musicTracks.Length > 0)
            PlayMusic(startingTrack, false);
    }

    private void Update()
    {
        // Playlist mode
        if (playPlaylist && !audioSource.isPlaying && audioSource.clip != null)
        {
            PlayNextMusic();
        }
    }

    /// <summary>
    /// Plays a specific song.
    /// Calling this automatically disables playlist mode.
    /// </summary>
    public void PlayMusic(int index)
    {
        PlayMusic(index, true);
    }

    private void PlayMusic(int index, bool disablePlaylist)
    {
        if (musicTracks == null || musicTracks.Length == 0)
        {
            Debug.LogWarning("MusicManager: No music tracks assigned.");
            return;
        }

        if (index < 0 || index >= musicTracks.Length)
        {
            Debug.LogWarning($"MusicManager: Invalid music index {index}.");
            return;
        }

        if (musicTracks[index] == null)
        {
            Debug.LogWarning($"MusicManager: Music track {index} is empty.");
            return;
        }

        if (disablePlaylist)
            playPlaylist = false;

        currentTrackIndex = index;

        audioSource.loop = !playPlaylist;
        audioSource.clip = musicTracks[index];
        audioSource.Play();
    }

    /// <summary>
    /// Enables playlist mode and starts from the specified track.
    /// </summary>
    public void StartPlaylist(int startingIndex = 0)
    {
        if (musicTracks == null || musicTracks.Length == 0)
        {
            Debug.LogWarning("MusicManager: No music tracks assigned.");
            return;
        }

        if (startingIndex < 0 || startingIndex >= musicTracks.Length)
            startingIndex = 0;

        playPlaylist = true;
        currentTrackIndex = startingIndex;

        audioSource.loop = false;
        audioSource.clip = musicTracks[currentTrackIndex];
        audioSource.Play();
    }

    /// <summary>
    /// Disables playlist mode and makes the current song loop.
    /// </summary>
    public void StopPlaylist()
    {
        playPlaylist = false;
        audioSource.loop = true;
    }

    private void PlayNextMusic()
    {
        currentTrackIndex++;

        // Reached the end of the array.
        if (currentTrackIndex >= musicTracks.Length)
            currentTrackIndex = 0;

        if (musicTracks[currentTrackIndex] == null)
        {
            PlayNextMusic();
            return;
        }

        audioSource.clip = musicTracks[currentTrackIndex];
        audioSource.Play();
    }

    public void StopMusic()
    {
        audioSource.Stop();
    }

    public void PauseMusic()
    {
        audioSource.Pause();
    }

    public void ResumeMusic()
    {
        audioSource.UnPause();
    }

    public void SetVolume(float newVolume)
    {
        volume = Mathf.Clamp01(newVolume);
        audioSource.volume = volume;
    }

    public void SetVolumePercent(float percent)
    {
        SetVolume(percent / 100f);
    }

    public bool IsPlaylistPlaying()
    {
        return playPlaylist;
    }

    public int GetCurrentTrackIndex()
    {
        return currentTrackIndex;
    }

    public AudioClip GetCurrentMusic()
    {
        return audioSource.clip;
    }
}