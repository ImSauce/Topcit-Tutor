using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class PageManager : MonoBehaviour
{
    [Header("Page Buttons")]
    [SerializeField] private Button nextPageButton;
    [SerializeField] private Button previousPageButton;

    [Header("Pages")]
    [SerializeField] private GameObject[] pages;

    [Header("Page Counter")]
    [SerializeField] private TMP_Text pageText;

    private int currentPage = 0;

    private void Start()
    {
        // Hide all pages first
        for (int i = 0; i < pages.Length; i++)
        {
            if (pages[i] != null)
                pages[i].SetActive(false);
        }

        // Show the first page
        if (pages.Length > 0)
            pages[currentPage].SetActive(true);

        // Connect buttons
        if (nextPageButton != null)
            nextPageButton.onClick.AddListener(NextPage);

        if (previousPageButton != null)
            previousPageButton.onClick.AddListener(PreviousPage);

        UpdatePageText();
        UpdateButtonStates();
    }

    public void NextPage()
    {
        if (currentPage >= pages.Length - 1)
            return;

        pages[currentPage].SetActive(false);

        currentPage++;

        pages[currentPage].SetActive(true);

        UpdatePageText();
        UpdateButtonStates();
    }

    public void PreviousPage()
    {
        if (currentPage <= 0)
            return;

        pages[currentPage].SetActive(false);

        currentPage--;

        pages[currentPage].SetActive(true);

        UpdatePageText();
        UpdateButtonStates();
    }

    private void UpdatePageText()
    {
        if (pageText != null)
        {
            pageText.text = $"{currentPage + 1}/{pages.Length}";
        }
    }

    private void UpdateButtonStates()
    {
        if (previousPageButton != null)
            previousPageButton.interactable = currentPage > 0;

        if (nextPageButton != null)
            nextPageButton.interactable = currentPage < pages.Length - 1;
    }
}