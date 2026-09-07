from models import verify_evidence_quotes

def test_verify_evidence_quotes():
    draft_text = "This is a sample document. It contains some text that we want to quote. Let's see if the fuzzy matcher works."
    
    # Exact match
    quotes = ["It contains some text that we want to quote."]
    verified = verify_evidence_quotes(quotes, draft_text, context_note="test")
    assert len(verified) == 1
    assert verified[0].confidence_score == 1.0
    assert verified[0].char_start > 0
    assert verified[0].char_end > verified[0].char_start
    
    # Fuzzy match (whitespace differences)
    quotes_fuzzy = ["It contains some text\nthat we want to quote."]
    verified_fuzzy = verify_evidence_quotes(quotes_fuzzy, draft_text, context_note="test")
    assert len(verified_fuzzy) == 1
    assert verified_fuzzy[0].confidence_score == 0.7
    
    # Missing quote
    quotes_missing = ["This text is definitely not in the document."]
    verified_missing = verify_evidence_quotes(quotes_missing, draft_text, context_note="test")
    assert len(verified_missing) == 1
    assert verified_missing[0].confidence_score == 0.0
    assert verified_missing[0].char_start == -1
    assert verified_missing[0].char_end == -1
