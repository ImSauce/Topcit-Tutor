using UnityEngine;

public class Bullet : MonoBehaviour
{
    [SerializeField] private float lifeTime = 5f;

    private void Start()
    {
        Destroy(gameObject, lifeTime);
    }

    private void OnCollisionEnter(Collision collision)
    {
        // Check if what we hit is an answer cube
        AnswerTarget target = collision.gameObject.GetComponent<AnswerTarget>();
        if (target != null)
        {
            target.GetShot();
        }

        Destroy(gameObject);
    }
}