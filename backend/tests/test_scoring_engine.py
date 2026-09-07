import pytest
from services.evaluators import _letter_grade
from models import CriterionEvaluation

def test_letter_grade():
    assert _letter_grade(85.0) == "HD"
    assert _letter_grade(84.9) == "D"
    assert _letter_grade(75.0) == "D"
    assert _letter_grade(74.9) == "C"
    assert _letter_grade(65.0) == "C"
    assert _letter_grade(64.9) == "P"
    assert _letter_grade(50.0) == "P"
    assert _letter_grade(49.9) == "F"

def test_zero_weight_isolation():
    # If a criterion has weight 0 or max score 0, it should be isolated as advisory.
    c1 = CriterionEvaluation(
        criterion_id="1",
        criterion_title="Normal",
        assigned_score=8.0,
        max_score=10.0,
        percentage=80.0,
        jury_scores={},
        was_arbitrated=False,
        arbitration_notes="",
        evidence=[],
        critique="",
        actionable_questions=[],
        confidence=0.9,
        is_advisory=False
    )
    
    c2 = CriterionEvaluation(
        criterion_id="2",
        criterion_title="Hurdle",
        assigned_score=0.0,
        max_score=0.0,
        percentage=0.0,
        jury_scores={},
        was_arbitrated=False,
        arbitration_notes="",
        evidence=[],
        critique="",
        actionable_questions=[],
        confidence=0.9,
        is_advisory=True
    )
    
    criteria = [c1, c2]
    total_score = sum(rc.assigned_score for rc in criteria if not rc.is_advisory)
    max_possible = sum(rc.max_score for rc in criteria if not rc.is_advisory)
    
    assert total_score == 8.0
    assert max_possible == 10.0
