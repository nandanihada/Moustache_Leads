"""
Migration: Seed the Qualification Survey for the offerwall.

This creates a special survey with type='qualification' that users must complete
to unlock all offers on the offerwall. Uses upsert to avoid duplicates.

Run from backend/: python migrations/seed_qualification_survey.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from datetime import datetime


def seed_qualification_survey():
    collection = db_instance.get_collection('surveys')
    if collection is None:
        print("ERROR: Could not connect to database")
        return

    questions = [
        # General Section
        {
            "id": "q1",
            "text": "What is your gender?",
            "type": "mcq",
            "options": ["Male", "Female", "Other"],
            "required": True,
            "section": "General"
        },
        {
            "id": "q2",
            "text": "Select your date of birth",
            "type": "text",
            "options": [],
            "required": True,
            "section": "General"
        },
        {
            "id": "q3",
            "text": "What is your email?",
            "type": "text",
            "options": [],
            "required": True,
            "section": "General"
        },
        # Background Section
        {
            "id": "q4",
            "text": "Did you ever played casino?",
            "type": "yes_no",
            "options": ["Yes", "No"],
            "required": True,
            "section": "Background"
        },
        {
            "id": "q5",
            "text": "Which of the following activities do you do regularly?",
            "type": "mcq_multi",
            "options": [
                "Foreign trips",
                "Watching musical performances",
                "None of the above",
                "Ski trips to ski resorts",
                "Shopping for branded clothes",
                "Visits to the vet with a pet",
                "Watching esports games",
                "Playing video games",
                "Other"
            ],
            "required": True,
            "section": "Background"
        },
        # Work Section
        {
            "id": "q6",
            "text": "Select your devices",
            "type": "mcq_multi",
            "options": [
                "Phone (android)",
                "Phone (ios)",
                "PC (windows)",
                "PC (macos)",
                "PC (linux)",
                "Ipad",
                "Tablet (android)",
                "Other"
            ],
            "required": True,
            "section": "Work"
        },
        {
            "id": "q7",
            "text": "What department do you work in?",
            "type": "mcq",
            "options": [
                "Administration",
                "Customer Service",
                "Board of Directors/Board",
                "Finance/Accounting",
                "Human Resources Department",
                "Legal department",
                "Marketing department",
                "Operations department",
                "Orders department",
                "Sales/Business Development",
                "Technology Development Hardware",
                "Technology Development Software",
                "Technology implementation",
                "Other",
                "Does not work"
            ],
            "required": True,
            "section": "Work"
        },
        # Role Section
        {
            "id": "q8",
            "text": "Do you spend money on games or apps?",
            "type": "yes_no",
            "options": ["Yes", "No"],
            "required": True,
            "section": "Role"
        },
        {
            "id": "q9",
            "text": "What languages do you know?",
            "type": "mcq_multi",
            "options": [
                "English",
                "Polish",
                "German",
                "Spanish",
                "Portuguese",
                "Russian",
                "French",
                "Italian",
                "Dutch",
                "Other"
            ],
            "required": True,
            "section": "Role"
        },
        {
            "id": "q10",
            "text": "What is your current employment status?",
            "type": "mcq",
            "options": [
                "Full time",
                "Employed part-time",
                "Full-time self-employed",
                "Part-time self-employed",
                "Active military service",
                "Retired Military/Veteran",
                "Temporarily unemployed",
                "Housewife",
                "Retired",
                "Student",
                "Disabled",
                "I prefer not to answer"
            ],
            "required": True,
            "section": "Role"
        },
        {
            "id": "q11",
            "text": "Do you have children under 18?",
            "type": "yes_no",
            "options": ["Yes", "No"],
            "required": True,
            "section": "Role"
        },
        {
            "id": "q12",
            "text": "Do you own and drive a car?",
            "type": "yes_no",
            "options": ["Yes", "No"],
            "required": True,
            "section": "Role"
        },
        # Address Section
        {
            "id": "q13",
            "text": "What is your country?",
            "type": "text",
            "options": [],
            "required": True,
            "section": "Address"
        },
        {
            "id": "q14",
            "text": "What is your state?",
            "type": "text",
            "options": [],
            "required": True,
            "section": "Address"
        },
        {
            "id": "q15",
            "text": "What is your zip code?",
            "type": "text",
            "options": [],
            "required": True,
            "section": "Address"
        },
        {
            "id": "q16",
            "text": "What is your phone number?",
            "type": "text",
            "options": [],
            "required": True,
            "section": "Address"
        },
    ]

    survey_doc = {
        "name": "Qualification Survey",
        "type": "qualification",
        "status": "active",
        "placement": "offerwall_qualification",
        "description": "Complete this survey to unlock all offers",
        "questions": questions,
        "created_at": datetime.utcnow(),
        "created_by": "system"
    }

    # Upsert: check if qualification survey already exists
    existing = collection.find_one({"type": "qualification"})
    if existing:
        print(f"Qualification survey already exists (ID: {existing['_id']}). Updating...")
        collection.update_one(
            {"type": "qualification"},
            {"$set": {
                "name": survey_doc["name"],
                "status": survey_doc["status"],
                "placement": survey_doc["placement"],
                "description": survey_doc["description"],
                "questions": survey_doc["questions"],
                "updated_at": datetime.utcnow()
            }}
        )
        print("Qualification survey updated successfully.")
    else:
        result = collection.insert_one(survey_doc)
        print(f"Qualification survey created successfully (ID: {result.inserted_id})")

    print(f"Total questions: {len(questions)}")
    print("Sections: General (3), Background (2), Work (2), Role (5), Address (4)")


if __name__ == '__main__':
    seed_qualification_survey()
