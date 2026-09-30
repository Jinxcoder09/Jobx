import json
import unittest
from unittest.mock import AsyncMock, patch

from app.models import AiOptimizeRequest
from app.routes.ai import _merge_optimization_patch, ai_optimize_resume


class OptimizationMergeTests(unittest.TestCase):
    def setUp(self) -> None:
        request = AiOptimizeRequest(
            resume={
                "personal": {
                    "fullName": "Ada Lovelace",
                    "email": "ada@example.com",
                },
                "summary": "Software engineer building reliable services.",
                "experience": [
                    {
                        "id": "experience-1",
                        "company": "ACME",
                        "role": "Software Engineer",
                        "startDate": "2020",
                        "endDate": "2024",
                        "bullets": ["Built Python APIs that reduced latency by 20%."],
                    }
                ],
                "projects": [
                    {
                        "id": "project-1",
                        "name": "Delivery Service",
                        "description": "Built a delivery API with FastAPI.",
                        "technologies": ["FastAPI"],
                    }
                ],
                "skills": [
                    {
                        "id": "skills-1",
                        "category": "Technical",
                        "items": ["Python"],
                    }
                ],
            },
            currentScore=60,
        )
        self.original = request.resume.model_dump()

    def test_merges_copy_without_allowing_factual_field_changes(self) -> None:
        optimized, changes = _merge_optimization_patch(
            self.original,
            {
                "personal": {"fullName": "Changed Name"},
                "experience": [
                    {
                        "id": "experience-1",
                        "company": "Different Company",
                        "bullets": ["Engineered Python APIs, reducing latency by 20%."],
                    }
                ],
            },
        )

        self.assertEqual(optimized["personal"]["fullName"], "Ada Lovelace")
        self.assertEqual(optimized["experience"][0]["company"], "ACME")
        self.assertEqual(
            optimized["experience"][0]["bullets"],
            ["Engineered Python APIs, reducing latency by 20%."],
        )
        self.assertTrue(changes)

    def test_rejects_rewrites_that_invent_or_change_metrics(self) -> None:
        optimized, changes = _merge_optimization_patch(
            self.original,
            {
                "experience": [
                    {
                        "id": "experience-1",
                        "bullets": ["Engineered Python APIs, reducing latency by 50%."],
                    }
                ]
            },
        )

        self.assertEqual(
            optimized["experience"][0]["bullets"],
            ["Built Python APIs that reduced latency by 20%."],
        )
        self.assertEqual(changes, [])

    def test_adds_only_skills_evidenced_by_original_content(self) -> None:
        optimized, changes = _merge_optimization_patch(
            self.original,
            {
                "skills": [
                    {
                        "id": "skills-1",
                        "items": ["Python", "FastAPI", "Kubernetes", "Java"],
                    }
                ]
            },
        )

        self.assertEqual(optimized["skills"][0]["items"], ["Python", "FastAPI"])
        self.assertTrue(any("skill keyword" in change for change in changes))

    def test_rejects_bullet_count_changes(self) -> None:
        optimized, changes = _merge_optimization_patch(
            self.original,
            {
                "experience": [
                    {
                        "id": "experience-1",
                        "bullets": [
                            "Engineered Python APIs, reducing latency by 20%.",
                            "Added an unsupported claim.",
                        ],
                    }
                ]
            },
        )

        self.assertEqual(
            optimized["experience"][0]["bullets"],
            ["Built Python APIs that reduced latency by 20%."],
        )
        self.assertEqual(changes, [])


class OptimizationEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_enhances_then_rescores_the_updated_resume(self) -> None:
        request = AiOptimizeRequest(
            resume={
                "summary": "Backend engineer building Python services.",
                "experience": [
                    {
                        "id": "experience-1",
                        "role": "Backend Engineer",
                        "company": "ACME",
                        "bullets": ["Built Python services for internal users."],
                    }
                ],
            },
            currentScore=55,
            feedback=["Use stronger action-led language."],
        )
        ai_patch = json.dumps(
            {
                "optimized": {
                    "summary": "Backend engineer delivering reliable Python services.",
                    "experience": [
                        {
                            "id": "experience-1",
                            "bullets": ["Engineered Python services for internal users."],
                        }
                    ],
                }
            }
        )
        fresh_score = {
            "score": 72,
            "strengths": ["Clear action-led experience."],
            "improvements": ["Add verified impact metrics where available."],
        }

        with (
            patch("app.routes.ai.groq_chat", new=AsyncMock(return_value=ai_patch)),
            patch("app.routes.ai._analyze_ats_score", new=AsyncMock(return_value=fresh_score)) as score_mock,
        ):
            response = await ai_optimize_resume(request)

        self.assertEqual(response["previousScore"], 55)
        self.assertEqual(response["score"], 72)
        self.assertEqual(
            response["data"]["experience"][0]["bullets"],
            ["Engineered Python services for internal users."],
        )
        score_mock.assert_awaited_once()
        rescored_resume = score_mock.await_args.args[0]
        self.assertEqual(
            rescored_resume["experience"][0]["bullets"],
            ["Engineered Python services for internal users."],
        )


if __name__ == "__main__":
    unittest.main()
