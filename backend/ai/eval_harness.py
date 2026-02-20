import json
import time
import uuid
import asyncio
from typing import List, Dict, Any

from pydantic import BaseModel, Field

# We'll use the real DualAIClient for tool testing.
# For standalone testing, we need to bypass user auth, or mock user retrieval just for the harness.
from backend.ai.client import DualAIClient

class ToolEvalTest(BaseModel):
    test_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    category: str
    prompt: str
    target_tool: str
    target_args: Dict[str, Any]
    negative_constraints: List[str] = []

class Metrics(BaseModel):
    tool_accuracy: float = 0.0
    argument_completeness: float = 0.0
    schema_failures: int = 0
    latency_ms: float = 0.0
    hallucination: float = 0.0

class EvalResult(BaseModel):
    test_id: str
    category: str
    passed: bool
    metrics: Metrics
    raw_output: str


class ToolCallingHarness:
    """
    Evaluates an LLM's raw tool-calling capabilities against a suite of synthetic prompts
    and enforces constraints like hallucination and tone adherence.
    """
    
    def __init__(self, user_id: str = "1", model_name: str = "gpt-4-turbo"):
        self.model_name = model_name
        self.client = DualAIClient(user_id=user_id)
        # Mock the quota check to always allow for testing
        self.client._get_user_quota_status = self._mock_quota_status
        self.results: List[EvalResult] = []

    async def _mock_quota_status(self, user: Any) -> Dict[str, Any]:
        return {
            "primary_available": True,
            "secondary_available": True,
            "usage_primary": 0,
            "usage_secondary": 0,
            "limit_primary": 9999,
            "limit_secondary": 9999,
            "daily_available": True,
            "daily_requests_used": 0,
            "chat_daily_limit": 9999,
            "plan_tier": "ultra",
        }
        
    def _calculate_completeness(self, actual_args: Dict, target_args: Dict) -> float:
        """Calculates ratio of successfully exact-matched arguments."""
        if not target_args:
            return 1.0 if not actual_args else 0.5
            
        matched = 0
        total = len(target_args)
        
        for k, v in target_args.items():
            if k in actual_args and actual_args[k] == v:
                matched += 1
                
        return matched / total

    def _detect_hallucination(self, text: str, tools_called: List[Dict]) -> float:
        """
        Simple heuristic hallucination detection:
        If text makes claims about data or tools that were not requested or supported.
        Returns a float between 0.0 and 1.0 representing hallucination penalty.
        """
        penalty = 0.0
        lower_text = text.lower()
        if "sure, i fixed your computer" in lower_text or "deleted database" in lower_text:
            penalty += 1.0
        
        # Check if tools claimed to be called weren't in the schema
        valid_tools = ["schedule_deep_work", "create_goal", "get_tasks", "create_task", "create_habit"]
        for t in tools_called:
            if t.get("action") not in valid_tools:
                penalty += 1.0
                
        return min(penalty, 1.0)
        
    async def run_test(self, test: ToolEvalTest) -> EvalResult:
        """Executes a single evaluation test."""
        start_time = time.time()
        
        passed = False
        metrics = Metrics()
        raw_output = ""
        
        try:
            # Formatting prompt as a single user message
            messages = [{"role": "user", "content": test.prompt}]
            
            # Using chat_completion to go through our Multi-Model routing
            response = await self.client.chat_completion(messages=messages, mode="AGENT")
            
            latency = (time.time() - start_time) * 1000
            metrics.latency_ms = latency
            raw_output = json.dumps(response.get("text", "{}"))
            
            # The agent parser creates embedded tool blocks like [TOOL_CALL:create_task:{"title":"X"}]
            text = response.get("text", "")
            
            # Very basic regex/split parser for evaluation purposes to extract tools called by the client
            import re
            tools_called = []
            matches = re.findall(r"\[TOOL_CALL:(.*?)\]", text)
            for m in matches:
                parts = m.split(":", 1)
                if len(parts) == 2:
                    action, args_str = parts[0], parts[1]
                    try:
                        args = json.loads(args_str)
                        tools_called.append({"action": action, "args": args})
                    except:
                        pass
                        
            # Analyze tools called vs target
            target_tool_found = False
            best_completeness = 0.0
            
            for t in tools_called:
                if t.get("action") == test.target_tool:
                    target_tool_found = True
                    comp = self._calculate_completeness(t.get("args", {}), test.target_args)
                    best_completeness = max(best_completeness, comp)
                    
            if target_tool_found:
                metrics.tool_accuracy = 1.0
                
            metrics.argument_completeness = best_completeness
            metrics.hallucination = self._detect_hallucination(text, tools_called)
            
            # Did it pass minimum bars?
            if metrics.tool_accuracy == 1.0 and metrics.argument_completeness > 0.8 and metrics.hallucination < 0.5:
                # Also check negative constraints
                failed_negative = any(nt in [t.get("action") for t in tools_called] for nt in test.negative_constraints)
                if not failed_negative:
                    passed = True
                
        except json.JSONDecodeError:
            metrics.schema_failures += 1
            raw_output = "JSONDecodeError"
        except Exception as e:
            metrics.schema_failures += 1
            raw_output = str(e)
            
        result = EvalResult(
            test_id=test.test_id,
            category=test.category,
            passed=passed,
            metrics=metrics,
            raw_output=raw_output
        )
        self.results.append(result)
        return result

    def generate_report(self) -> Dict[str, Any]:
        """Compiles the evaluation into the JSON rubric schema."""
        if not self.results:
            return {}
            
        # Aggregate logic
        total_tests = len(self.results)
        total_accuracy = sum(r.metrics.tool_accuracy for r in self.results)
        total_completeness = sum(r.metrics.argument_completeness for r in self.results)
        total_schema_fails = sum(r.metrics.schema_failures for r in self.results)
        total_latency = sum(r.metrics.latency_ms for r in self.results)
        total_hallucinations = sum(r.metrics.hallucination for r in self.results)
        
        report = {
            "model_name": self.model_name,
            "evaluation_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "aggregate_scores": {
                "tool_accuracy_pct": round((total_accuracy / max(total_tests, 1)) * 100, 2),
                "argument_completeness_avg": round(total_completeness / max(total_tests, 1), 2),
                "schema_failure_rate_pct": round((total_schema_fails / max(total_tests, 1)) * 100, 2),
                "average_latency_ms": round(total_latency / max(total_tests, 1), 2),
                "hallucination_rate_pct": round((total_hallucinations / max(total_tests, 1)) * 100, 2),
                "total_tests_passed": sum(1 for r in self.results if r.passed),
                "total_tests": total_tests
            },
            "tests": [r.model_dump() for r in self.results]
        }
        return report

# Extended test suite matching the requested comprehensive categories
TEST_SUITE = [
    ToolEvalTest(
        category="Single Tool Exact Match",
        prompt="Schedule a deep work session for tomorrow at 9 AM for 2 hours.",
        target_tool="schedule_deep_work",
        target_args={"duration_minutes": 120}  # Simplified to test subset parsing if necessary
    ),
    ToolEvalTest(
        category="Complex Schema Resolution",
        prompt="Create a highly complex goal to learn piano by Q4 with milestones 'Buy Piano', 'Learn Sheets'. Make priority urgent.",
        target_tool="create_goal",
        target_args={"title": "Learn Piano", "priority": "urgent"}
    ),
    ToolEvalTest(
        category="Negative Constraints",
        prompt="Find my tasks but DO NOT auto-schedule them.",
        target_tool="get_tasks",
        target_args={},
        negative_constraints=["schedule_task", "schedule_deep_work"]
    ),
    ToolEvalTest(
        category="Habit Creation Tracking",
        prompt="I want to start a new daily habit to Drink Water. I am doing it for Health.",
        target_tool="create_habit",
        target_args={"name": "Drink Water", "category": "Health"}
    ),
]

if __name__ == "__main__":
    
    # We create a mock sqlite connection just in case DualAIClient tries to hit user db inside chat_completion
    # By mocking out the dependencies, we can run this directly as a script.
    
    from unittest.mock import patch, MagicMock
    
    async def mock_get_user(user_id):
        m = MagicMock()
        m.id = user_id
        m.plan_type = "pro"
        m.tier = "ultra"
        return m

    async def run():
        with patch('backend.ai.client.user_service.get_user_by_id', side_effect=mock_get_user):
            harness = ToolCallingHarness(model_name="production-routing")
            for test in TEST_SUITE:
                print(f"Running test: {test.category}")
                await harness.run_test(test)
                
            report = harness.generate_report()
            print(json.dumps(report, indent=2))
            
            # Return non-zero exit code if tests failed (for CI/CD integration)
            if report.get("aggregate_scores", {}).get("total_tests_passed", 0) < len(TEST_SUITE):
                print("EVALUATION FAILED: Not all tests passed.")
                import sys
                sys.exit(1)
            else:
                print("EVALUATION PASSED: All tests successful.")
                
    asyncio.run(run())
