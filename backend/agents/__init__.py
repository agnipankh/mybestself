# agents/__init__.py - Agent system package

from .base import BaseAgent
from .educational import EducationalAgent
from .discovery import DiscoveryAgent
from .refinement import RefinementAgent
from .goal import GoalAgent
from .management import ManagementAgent

__all__ = [
    'BaseAgent',
    'EducationalAgent', 
    'DiscoveryAgent',
    'RefinementAgent',
    'GoalAgent',
    'ManagementAgent'
]