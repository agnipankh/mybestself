// services/conversation/agents/RefinementAgent.ts
import { BaseAgent } from './BaseAgent'
import { ConversationContext, AgentResult, AgentType, PersonaAction } from '../ConversationContext'

export class RefinementAgent extends BaseAgent {
  readonly type = AgentType.REFINEMENT

  canHandle(userMessage: string, context: ConversationContext): boolean {
    const msg = userMessage.toLowerCase()
    return msg.includes('refine') || msg.includes('change') || 
           msg.includes('better') || msg.includes('improve') ||
           msg.includes('update') || msg.includes('modify') ||
           !!context.targetPersonaId
  }

  generateSystemPrompt(context: ConversationContext): string {
    const targetPersona = context.targetPersonaId ? 
      `You are helping refine the "${context.targetPersonaId}" persona specifically.` :
      'You are helping the user refine one of their existing personas.'

    return `You are a life coach specializing in persona refinement and optimization.

${targetPersona}

Your mission: Help users create more precise, actionable, and meaningful personas.

REFINEMENT PROCESS:
1. **Clarify Purpose**: What role does this persona serve in their life?
2. **Sharpen the North Star**: Make it specific, measurable, and inspiring
3. **Identify Conflicts**: Does this overlap with other personas? How to differentiate?
4. **Make it Actionable**: Can they use this to make daily decisions?

CONVERSATION TECHNIQUES:
- Ask "What does excellence look like for this persona?"
- Explore "When you're at your best in this role, what are you doing?"
- Challenge vague language: "What specifically does 'successful' mean?"
- Help them find their unique angle: "What makes YOUR version of this persona special?"

RESPONSE FORMAT:
When they arrive at a refined version, use:
REFINED_PERSONA: [exact persona name] | [improved north star]

EXAMPLES OF GOOD REFINEMENT:
- Before: "Professional | Be successful"
- After: "Strategic Leader | Create environments where teams thrive through clear vision and empowered decision-making"

- Before: "Parent | Be a good parent"  
- After: "Nurturing Guide | Raise confident, curious children who feel loved unconditionally while learning life skills"

Current context:
${context.temporaryState.draftPersonas ? 
  `Working with these personas: ${JSON.stringify(context.temporaryState.draftPersonas)}` : 
  'General refinement discussion - help them identify which persona to work on'
}

Be encouraging but push for specificity. Help them discover what truly matters.`
  }

  processResponse(aiResponse: string, context: ConversationContext): AgentResult {
    const personaActions = this.parseRefinementActions(aiResponse)
    const cleanResponse = this.cleanResponseForUser(aiResponse)
    
    return {
      userResponse: cleanResponse,
      personaActions,
      contextUpdates: {
        // You could track refinement progress here
        temporaryState: {
          ...context.temporaryState,
          lastRefinementSession: Date.now()
        }
      }
    }
  }

  private parseRefinementActions(response: string): PersonaAction[] {
    const actions: PersonaAction[] = []
    
    // Look for refined personas with the specific format
    const refinedRegex = /REFINED_PERSONA:\s*([^|]+?)\s*\|\s*([^\n]+)/gi
    
    let match
    while ((match = refinedRegex.exec(response)) !== null) {
      const personaName = match[1].trim()
      const northStar = match[2].trim()
      
      // Only add if both name and north star are meaningful
      if (personaName && northStar && northStar.length > 10) {
        actions.push({
          type: 'update',
          name: personaName,
          northStar: northStar
        })
      }
    }
    
    return actions
  }

  protected cleanResponseForUser(aiResponse: string): string {
    // Remove the REFINED_PERSONA formatting but keep the content natural
    return super.cleanResponseForUser(aiResponse)
      .replace(/REFINED_PERSONA:\s*[^|]+\|[^\n]+\n?/gi, '')
      .trim()
  }
}
