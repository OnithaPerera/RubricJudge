import pytest
from utils.document_loader import extract_text_from_upload

def test_extract_text_short_document():
    # A text document with less than 30 words should raise ValueError
    short_text = "This is a very short draft. " * 2
    short_bytes = short_text.encode("utf-8")
    
    with pytest.raises(ValueError) as excinfo:
        extract_text_from_upload("test.txt", short_bytes)
        
    assert "too short" in str(excinfo.value)

def test_extract_text_sufficient_length():
    # A text document with > 30 words should parse successfully
    sufficient_text = "Word " * 40
    sufficient_bytes = sufficient_text.encode("utf-8")
    
    result = extract_text_from_upload("test.txt", sufficient_bytes)
    assert len(result.split()) == 40

def test_unsupported_extension():
    with pytest.raises(ValueError) as excinfo:
        extract_text_from_upload("test.jpeg", b"dummy data")
    assert "Unsupported file type" in str(excinfo.value)
