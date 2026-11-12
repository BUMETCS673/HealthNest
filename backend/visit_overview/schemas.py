"""
AI-USAGE SUMMARY
Tools: ChatGPT
Overall AI Contribution: ~60%
AI-Assisted Areas: Helped define a flexible VisitOverviewOut response schema for the provider visit overview API.
Human Contributions: Chose to simplify the schema to match the existing project style and avoid unnecessary nested schema classes.
"""

from __future__ import annotations

from pydantic import BaseModel


class VisitPatient(BaseModel):
    id: str
    name: str
    initials: str
    mrn: str | None = None
    dateOfBirth: str | None = None


class VisitAppointment(BaseModel):
    id: str
    time: str | None = None
    date: str | None = None
    visitType: str | None = None
    status: str | None = None


class RecentHistoryItem(BaseModel):
    date: str | None = None
    provider: str | None = None
    title: str
    detail: str


class ActiveProblemItem(BaseModel):
    name: str
    code: str | None = None
    since: str | None = None
    status: str | None = None


class MedicationItem(BaseModel):
    medication: str
    dose: str | None = None
    frequency: str | None = None
    prescriber: str | None = None


class LabItem(BaseModel):
    test: str
    result: str | None = None
    date: str | None = None
    status: str | None = None


class OpenIssueItem(BaseModel):
    level: str
    tone: str
    text: str


class VisitOverviewOut(BaseModel):
    patient: VisitPatient
    appointment: VisitAppointment
    generatedFrom: str
    summary: str
    recentHistory: list[RecentHistoryItem]
    activeProblems: list[ActiveProblemItem]
    medications: list[MedicationItem]
    labs: list[LabItem]
    openIssues: list[OpenIssueItem]
    missingSections: list[str]