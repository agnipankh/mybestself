"use client"

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/components/AuthGuard'
import { apiClient, DashboardData } from '@/services/apiClient'

// Use the types from apiClient, but extend with color for visualization
interface VisualizationPersona {
  id: string
  name: string
  importance: number
  color: string
  progress: number
  actual_time: number
  goals: Array<{
    id: string
    name: string
    planned: number
    actual: number
    progress: number
  }>
}

interface VisualizationData {
  user: {
    id: string
    name: string
    overall_progress: number
  }
  personas: VisualizationPersona[]
}

// Professional color palette
const colors = {
  // Progress colors (red, green, blue variants)
  progress: {
    high: '#0F766E',    // Teal-700 (success - sophisticated green)
    medium: '#0369A1',  // Sky-700 (partial - professional blue) 
    low: '#BE123C'      // Rose-700 (behind - elegant red)
  },
  // Effort gap border colors
  effort: {
    over: '#BE123C',     // Rose-700 (over-spent)
    under: '#0369A1',    // Sky-700 (under-spent)
    target: '#0F766E'    // Teal-700 (on-target)
  },
  // Persona colors (warm, sophisticated palette)
  personas: [
    '#7C2D92',  // Purple-700 (deep purple)
    '#C2410C',  // Orange-700 (warm orange)
    '#92400E',  // Amber-700 (golden amber)  
    '#374151',  // Gray-700 (sophisticated charcoal)
    '#6B21A8',  // Violet-700 (rich violet)
    '#1E40AF'   // Blue-700 (navy blue)
  ]
}

// Convert API data to visualization format with colors
const convertToVisualizationData = (apiData: DashboardData): VisualizationData => {
  const personasWithColors = apiData.personas.map((persona, index) => ({
    ...persona,
    color: colors.personas[index % colors.personas.length]
  }))

  return {
    user: apiData.user,
    personas: personasWithColors
  }
}

export default function DashboardPage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState<VisualizationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const { user, isAuthenticated } = useAuth()

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.id) return

      setLoading(true)
      setError(null)
      
      try {
        const apiData = await apiClient.getDashboardData(user.id)
        const visualizationData = convertToVisualizationData(apiData)
        setData(visualizationData)
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [user?.id])

  useEffect(() => {
    if (!svgRef.current || !data) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const width = 800
    const height = 600
    const centerX = width / 2
    const centerY = height / 2

    // Create nodes array for D3 simulation
    const nodes: any[] = []
    const links: any[] = []

    // Add user node (center)
    nodes.push({
      id: data.user.id,
      type: 'user',
      name: data.user.name,
      progress: data.user.overallProgress,
      radius: 40,
      fx: centerX, // Fixed position
      fy: centerY
    })

    // Calculate total actual time across all personas for relative sizing
    const totalActualTime = data.personas.reduce((total, persona) => 
      total + persona.goals.reduce((sum, goal) => sum + goal.actual, 0), 0
    )
    
    // Add persona nodes
    data.personas.forEach((persona, i) => {
      // Calculate actual time spent as sum of actual hours on all goals
      const actualTime = persona.goals.reduce((sum, goal) => sum + goal.actual, 0)
      
      // Relative sizing: persona's share of total time, scaled to reasonable radius (15-35px)
      const timeShare = totalActualTime > 0 ? actualTime / totalActualTime : 0.25 // fallback if no time
      const personaRadius = 15 + (timeShare * 20 * data.personas.length) // Scale by number of personas
      
      nodes.push({
        id: persona.id,
        type: 'persona',
        name: persona.name,
        importance: persona.importance,
        progress: persona.progress,
        color: persona.color,
        radius: Math.max(personaRadius, 15), // Minimum 15px radius
        actualTime: actualTime, // Store for tooltip/display
        timeShare: timeShare
      })

      // Link persona to user
      links.push({
        source: data.user.id,
        target: persona.id,
        type: 'user-persona',
        strength: persona.importance / 5
      })

      // Add goal nodes
      persona.goals.forEach(goal => {
        const plannedRadius = Math.sqrt(goal.planned) * 4 + 12 // 16-32px based on planned hours (much larger)
        const effortDiff = Math.abs(goal.planned - goal.actual)
        const borderWidth = Math.min(effortDiff * 0.8, 6) // Max 6px border (thicker)

        nodes.push({
          id: goal.id,
          type: 'goal',
          name: goal.name,
          planned: goal.planned,
          actual: goal.actual,
          progress: goal.progress,
          radius: plannedRadius,
          borderWidth: borderWidth,
          borderColor: goal.actual > goal.planned ? colors.effort.over : 
                      goal.actual < goal.planned * 0.9 ? colors.effort.under : colors.effort.target
        })

        // Link goal to persona
        links.push({
          source: persona.id,
          target: goal.id,
          type: 'persona-goal',
          distance: 80
        })
      })
    })

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id((d: any) => d.id)
        .distance((d: any) => d.distance || 120)
        .strength((d: any) => d.strength || 0.5)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(centerX, centerY))
      .force("collision", d3.forceCollide().radius((d: any) => d.radius + 5))

    // Create links
    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => d.type === 'user-persona' ? 3 : 1)

    // Create nodes
    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(d3.drag<any, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on("drag", (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          if (d.type !== 'user') { // Keep user centered
            d.fx = null
            d.fy = null
          }
        })
      )

    // Draw node circles
    node.append("circle")
      .attr("r", (d: any) => d.radius)
      .attr("fill", (d: any) => {
        if (d.type === 'user') return 'url(#userGradient)'
        if (d.type === 'persona') return d.color
        // Goal color based on progress using professional palette
        const progress = d.progress
        if (progress >= 80) return colors.progress.high
        if (progress >= 50) return colors.progress.medium
        return colors.progress.low
      })
      .attr("stroke", (d: any) => d.type === 'goal' ? d.borderColor : '#fff')
      .attr("stroke-width", (d: any) => d.type === 'goal' ? d.borderWidth : 2)
      .attr("opacity", 0.9)

    // Add progress rings for personas and user
    node.filter((d: any) => d.type !== 'goal')
      .append("circle")
      .attr("r", (d: any) => d.radius + 3)
      .attr("fill", "none")
      .attr("stroke", "#ddd")
      .attr("stroke-width", 2)

    node.filter((d: any) => d.type !== 'goal')
      .append("path")
      .attr("fill", "none")
      .attr("stroke", colors.progress.high)
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round")
      .attr("d", (d: any) => {
        const radius = d.radius + 3
        const progress = d.progress / 100
        const angle = progress * 2 * Math.PI - Math.PI / 2
        const x = radius * Math.cos(angle)
        const y = radius * Math.sin(angle)
        const largeArcFlag = progress > 0.5 ? 1 : 0
        
        if (progress === 0) return ""
        return `M 0,${-radius} A ${radius},${radius} 0 ${largeArcFlag},1 ${x},${y}`
      })

    // Add labels
    node.append("text")
      .text((d: any) => d.type === 'user' ? d.name : 
             d.type === 'persona' ? `${d.name} (${d.progress}%)` : 
             `${d.name.substring(0, 15)}...`)
      .attr("text-anchor", "middle")
      .attr("dy", (d: any) => d.radius + 15)
      .attr("font-size", (d: any) => d.type === 'user' ? '14px' : d.type === 'persona' ? '12px' : '10px')
      .attr("font-weight", (d: any) => d.type === 'user' ? 'bold' : 'normal')
      .attr("fill", "#374151")

    // Add progress percentage for goals
    node.filter((d: any) => d.type === 'goal')
      .append("text")
      .text((d: any) => `${d.progress}%`)
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "white")

    // Create gradient for user node
    const defs = svg.append("defs")
    const gradient = defs.append("radialGradient")
      .attr("id", "userGradient")
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#FCD34D")
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#F59E0B")

    // Add hover and click handlers
    node.on("mouseover", (event, d: any) => {
      if (d.type === 'goal') {
        // Create tooltip for full goal name and details
        const tooltip = d3.select("body")
          .append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "8px 12px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000")
          .html(`
            <strong>${d.name}</strong><br/>
            Progress: ${d.progress}%<br/>
            Planned: ${d.planned}h | Actual: ${d.actual}h<br/>
            Effort Gap: ${Math.abs(d.planned - d.actual).toFixed(1)}h
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px")
      }
      
      // Highlight the node
      d3.select(event.currentTarget)
        .select("circle")
        .attr("stroke-width", (d: any) => d.type === 'goal' ? d.borderWidth + 2 : 4)
        .attr("opacity", 1)
    })
    .on("mouseout", (event, d: any) => {
      // Remove tooltip
      d3.selectAll(".tooltip").remove()
      
      // Reset highlight
      d3.select(event.currentTarget)
        .select("circle")
        .attr("stroke-width", (d: any) => d.type === 'goal' ? d.borderWidth : 2)
        .attr("opacity", 0.9)
    })
    .on("click", (event, d: any) => {
      setSelectedNode(d.id)
    })

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`)
    })

  }, [data])

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your progress dashboard...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️ {error}</div>
          <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Show empty state if no data
  if (!data || !data.personas.length) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 mb-4">No personas or goals found</div>
          <p className="text-sm text-gray-500 mb-4">Create some personas and goals to see your progress dashboard</p>
          <Button onClick={() => window.location.href = '/mbs'} className="bg-blue-600 hover:bg-blue-700">
            Go to Setup
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Progress Dashboard</h1>
          <p className="text-gray-600">Visual overview of your personas and goals</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Visualization Panel */}
          <div className="lg:col-span-3">
            <Card className="h-[700px]">
              <CardHeader>
                <CardTitle>Force-Directed Progress Graph</CardTitle>
                <div className="flex gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{backgroundColor: colors.progress.high}}></div>
                    <span>On Track (80%+)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{backgroundColor: colors.progress.medium}}></div>
                    <span>Partial (50-79%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{backgroundColor: colors.progress.low}}></div>
                    <span>Behind (0-49%)</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <svg 
                  ref={svgRef} 
                  width="100%" 
                  height="600" 
                  viewBox="0 0 800 600"
                  className="border rounded-lg bg-white"
                />
              </CardContent>
            </Card>
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <strong>Node Sizes:</strong>
                  <ul className="mt-1 space-y-1 text-gray-600">
                    <li>• Goals: Planned effort hours</li>
                    <li>• Personas: Relative actual time spent</li>
                    <li>• User: Fixed size (center)</li>
                  </ul>
                </div>
                <div>
                  <strong>Border Colors:</strong>
                  <ul className="mt-1 space-y-1 text-gray-600">
                    <li className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded border-2" style={{borderColor: colors.effort.over}}></div>
                      Over-spent effort
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded border-2" style={{borderColor: colors.effort.under}}></div>
                      Under-spent effort
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded border-2" style={{borderColor: colors.effort.target}}></div>
                      Right on target
                    </li>
                  </ul>
                </div>
                <div>
                  <strong>Border Thickness:</strong>
                  <p className="text-gray-600">Represents gap between planned vs actual effort</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats & Calculations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Overall Progress:</span>
                    <span className="font-semibold">{data.user.overall_progress}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Personas:</span>
                    <span className="font-semibold">{data.personas.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Goals:</span>
                    <span className="font-semibold">
                      {data.personas.reduce((sum, p) => sum + p.goals.length, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>High Priority:</span>
                    <span className="font-semibold">
                      {data.personas.filter(p => p.importance >= 4).length} personas
                    </span>
                  </div>
                </div>
                
                <div className="pt-3 border-t">
                  <h4 className="font-semibold mb-2">Progress Calculation:</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>Goal Progress:</strong> User-reported %</div>
                    <div><strong>Persona Progress:</strong> Weighted avg of goals by planned effort</div>
                    <div><strong>User Progress:</strong> Weighted avg of personas by importance</div>
                  </div>
                  
                  <div className="mt-2 text-xs">
                    <strong>Example:</strong> If Professional (importance=5, progress=70%) and Health (importance=3, progress=80%), then User = (70×5 + 80×3)/(5+3) = 73.75%
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={async () => {
                if (!user?.id) return
                setLoading(true)
                try {
                  const apiData = await apiClient.getDashboardData(user.id)
                  const visualizationData = convertToVisualizationData(apiData)
                  setData(visualizationData)
                } catch (err) {
                  console.error('Failed to refresh dashboard data:', err)
                  setError('Failed to refresh data')
                } finally {
                  setLoading(false)
                }
              }} 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}