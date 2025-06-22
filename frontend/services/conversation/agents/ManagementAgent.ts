// services/conversation/agents/ManagementAgent.ts
import { BaseAgent } from './BaseAgent'
import { ConversationContext, AgentResult, AgentType, PersonaAction } from '../ConversationContext'

export class ManagementAgent extends BaseAgent {
  readonly type = AgentType.MANAGEMENT

  canHandle(userMessage: string, context: ConversationContext): boolean {
    const msg = userMessage.toLowerCase()
    return msg.includes('manage') || msg.includes('organize') || 
           msg.includes('review') || msg.includes('overview') ||
           msg.includes('list') || msg.includes('delete') ||
           msg.includes('remove') || msg.includes('show me') ||
           msg.includes('which personas')
  }

  generateSystemPrompt(context: ConversationContext): string {
    return `You are a persona management specialist helping users organize and oversee their collection of personas.

Your role: Help users understand, organize, and maintain their persona collection.

MANAGEMENT CAPABILITIES:
1. **Overview & Analysis**: Help users see patterns across their personas
2. **Organization**: Suggest groupings or relationships between personas
3. **Cleanup**: Identify redundant or conflicting personas
4. **Prioritization**: Help users focus on their most important personas
5. **Maintenance**: Suggest regular review practices

CONVERSATION TECHNIQUES:
- Ask "Which personas feel most active in your life right now?"
- Explore "Do any of these personas conflict with each other?"
- Suggest "Let's look at how these personas work together"
- Help identify "Which personas might need more attention?"

MANAGEMENT ACTIONS:
When suggesting specific management actions, use these formats:
- DELETE_PERSONA: [persona name] | [reason for deletion]
- MERGE_PERSONAS: [persona1] + [persona2] | [new merged name] | [combined north star]
- PRIORITIZE_PERSONA: [persona name] | [priority level: high/medium/low]

EXAMPLES OF GOOD MANAGEMENT ADVICE:
- "Your 'Professional' and 'Leader' personas seem to overlap. Consider merging them into 'Strategic Leader'"
- "You have 6 personas but mentioned only using 3. Let's focus on the active ones."
- "Your 'Creative' persona hasn't been mentioned lately. Is it still important to you?"

Current persona collection context:
${context.temporaryState.draftPersonas ? 
  `Working with: ${JSON.stringify(context.temporaryState.draftPersonas)}` : 
  'No current persona context - help them review their collection'
}

Be helpful and strategic. Focus on making their persona system more useful and manageable.`
  }

  processResponse(aiResponse: string, context: ConversationContext): AgentResult {
    const personaActions = this.parseManagementActions(aiResponse)
    const cleanResponse = this.cleanResponseForUser(aiResponse)
    
    return {
      userResponse: cleanResponse,
      personaActions,
      contextUpdates: {
        temporaryState: {
          ...context.temporaryState,
          lastManagementSession: Date.now(),
          managementFocus: this.extractManagementFocus(aiResponse)
        }
      }
    }
  }

  private parseManagementActions(response: string): PersonaAction[] {
    const actions: PersonaAction[] = []
    
    // Parse deletion suggestions
    const deleteRegex = /DELETE_PERSONA:\s*([^|]+?)\s*\|\s*([^\n]+)/gi
    let match
    while ((match = deleteRegex.exec(response)) !== null) {
      actions.push({
        type: 'delete',
        name: match[1].trim(),
        // Could add reason in metadata if needed
      })
    }
    
    // Parse merge suggestions (treat as update to first persona, delete second)
    const mergeRegex = /MERGE_PERSONAS:\s*([^+]+?)\s*\+\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^\n]+)/gi
    while ((match = mergeRegex.exec(response)) !== null) {
      const persona1 = match[1].trim()
      const persona2 = match[2].trim()
      const newName = match[3].trim()
      const newNorthStar = match[4].trim()
      
      // Update first persona with merged info
      actions.push({
        type: 'update',
        name: newName,
        northStar: newNorthStar,
        previousName: persona1
      })
      
      // Delete second persona
      actions.push({
        type: 'delete',
        name: persona2
      })
    }
    
    // Parse priority suggestions (could be used for UI hints)
    const priorityRegex = /PRIORITIZE_PERSONA:\s*([^|]+?)\s*\|\s*([^\n]+)/gi
    while ((match = priorityRegex.exec(response)) !== null) {
      // For now, we don't have priority in PersonaAction
      // But this could be added to metadata or handled differently
      console.log(`Priority suggestion: ${match[1].trim()} - ${match[2].trim()}`)
    }
    
    return actions
  }

  private extractManagementFocus(response: string): string {
    // Extract what type of management the user is focusing on
    const msg = response.toLowerCase()
    if (msg.includes('merge') || msg.includes('combine')) return 'merging'
    if (msg.includes('delete') || msg.includes('remove')) return 'cleanup'
    if (msg.includes('priority') || msg.includes('focus')) return 'prioritization'
    if (msg.includes('organize') || msg.includes('group')) return 'organization'
    return 'overview'
  }

  protected cleanResponseForUser(aiResponse: string): string {
    return super.cleanResponseForUser(aiResponse)
      .replace(/DELETE_PERSONA:\s*[^|]+\|[^\n]+\n?/gi, '')
      .replace(/MERGE_PERSONAS:\s*[^|]+\|[^\n]+\n?/gi, '')
      .replace(/PRIORITIZE_PERSONA:\s*[^|]+\|[^\n]+\n?/gi, '')
      .trim()
  }
}
