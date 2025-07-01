// services/conversation/agents/GoalAgent.ts
import { BaseAgent } from './BaseAgent'
import { ConversationContext, AgentResult, AgentType, GoalAction } from '../ConversationContext'

export class GoalAgent extends BaseAgent {
  readonly type = AgentType.GOAL

  canHandle(userMessage: string, context: ConversationContext): boolean {
    const msg = userMessage.toLowerCase()
    return msg.includes('goal') || msg.includes('achieve') || msg.includes('target') || 
           msg.includes('accomplish') || msg.includes('track') || msg.includes('progress')
  }

  generateSystemPrompt(context: ConversationContext): string {
    const persona = context.targetPersona
    const conversationHistory = context.conversationHistory.map(msg => `${msg.from}: ${msg.text}`).join('\n')
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    return `You are a goal-setting coach helping a user create and manage goals for their "${persona?.name}" persona.

PERSONA CONTEXT:
- Persona: ${persona?.name || 'Unknown'}
- Northstar: ${persona?.northStar || 'Unknown'}

CURRENT DATE: ${today}
SUGGESTED REVIEW DATE: ${nextWeek} (one week from today)

Your role is to help them:
1. Create specific, measurable goals that align with their persona's northstar
2. Define clear acceptance criteria for each goal
3. Set realistic review dates (suggest ${nextWeek} for weekly reviews)
4. Update existing goals when asked to modify them

GOAL CREATION FORMAT:
When a NEW goal is ready to be created, respond with:
GOAL_CONFIRMED: [goal name] | [acceptance criteria] | [review date in YYYY-MM-DD format]

GOAL UPDATE FORMAT:
When UPDATING an existing goal (changing dates, criteria, etc.), respond with:
GOAL_UPDATED: [original goal name] | [new goal name] | [new acceptance criteria] | [new review date in YYYY-MM-DD format]

Examples:
GOAL_CONFIRMED: Spend 30 minutes daily with kids | Have documented 30-minute quality time sessions 5 days per week | ${nextWeek}
GOAL_UPDATED: Spend 30 minutes daily with kids | Spend 45 minutes daily with kids | Have documented 45-minute quality time sessions 5 days per week | 2024-07-15

IMPORTANT:
- Today's date is ${today}
- When suggesting review dates, use ${nextWeek} or later
- If user wants to modify an existing goal, use GOAL_UPDATED format
- If user wants a completely new goal, use GOAL_CONFIRMED format
- Focus ONLY on goal creation and management - don't discuss persona changes
- Make goals specific and measurable

CONVERSATION CONTEXT:
${conversationHistory}

Be encouraging and help them create goals that truly serve their "${persona?.name}" persona.`
  }

  processResponse(aiResponse: string, context: ConversationContext): AgentResult {
    const goalActions = this.parseGoalActions(aiResponse)
    const cleanResponse = this.cleanResponseForUser(aiResponse)
    
    return {
      userResponse: cleanResponse,
      personaActions: [], // Goals are handled separately from persona actions
      goalActions,
      contextUpdates: {
        temporaryState: {
          ...context.temporaryState,
          goalSettingActive: true
        }
      }
    }
  }

  private parseGoalActions(response: string): GoalAction[] {
    const actions: GoalAction[] = []
    
    // Parse GOAL_CONFIRMED (new goals)
    const confirmRegex = /GOAL_CONFIRMED:\s*([^|]+)\|\s*([^|]+)\|\s*([^\n]+)/gi
    let match
    while ((match = confirmRegex.exec(response)) !== null) {
      actions.push({
        type: 'create',
        name: match[1].trim(),
        acceptanceCriteria: match[2].trim(),
        reviewDate: match[3].trim() // Keep as string, already in YYYY-MM-DD format
      })
    }
    
    // Parse GOAL_UPDATED (existing goal updates)
    const updateRegex = /GOAL_UPDATED:\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^\n]+)/gi
    while ((match = updateRegex.exec(response)) !== null) {
      actions.push({
        type: 'update',
        originalName: match[1].trim(),
        name: match[2].trim(),
        acceptanceCriteria: match[3].trim(),
        reviewDate: match[4].trim()
      })
    }
    
    return actions
  }
}