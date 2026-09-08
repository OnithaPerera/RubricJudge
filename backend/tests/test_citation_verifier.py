import pytest
from services.citation_verifier import DOI_PATTERN

def extract_dois(text: str) -> list:
    raw_dois = DOI_PATTERN.findall(text)
    return list(set([doi.rstrip(".,;:?") for doi in raw_dois]))

def test_doi_extraction():
    text = "Here is a paper with DOI: 10.1000/xyz123 and another 10.1038/s41586-020-2649-2."
    dois = extract_dois(text)
    assert len(dois) == 2
    assert "10.1000/xyz123" in dois
    assert "10.1038/s41586-020-2649-2" in dois

def test_doi_extraction_no_doi():
    text = "This text has no DOI. Just regular text."
    dois = extract_dois(text)
    assert len(dois) == 0

def test_doi_extraction_case_insensitive():
    text = "Here is a DOI: 10.1234/AbC-Def."
    dois = extract_dois(text)
    assert len(dois) == 1
    assert dois[0] == "10.1234/AbC-Def"
