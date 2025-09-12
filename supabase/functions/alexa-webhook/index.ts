import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== ALEXA WEBHOOK ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json()
    console.log('Alexa request:', JSON.stringify(requestBody, null, 2))

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extract user information from Alexa request
    const userId = requestBody.context?.System?.user?.userId
    const accessToken = requestBody.context?.System?.user?.accessToken
    
    console.log('User ID:', userId)
    console.log('Has access token:', !!accessToken)

    // Handle different request types
    const requestType = requestBody.request?.type
    console.log('Request type:', requestType)

    switch (requestType) {
      case 'LaunchRequest':
        return handleLaunchRequest(requestBody)
      
      case 'IntentRequest':
        return handleIntentRequest(requestBody, supabase, accessToken)
      
      case 'SessionEndedRequest':
        return handleSessionEndedRequest(requestBody)
      
      default:
        console.log('Unknown request type:', requestType)
        return createAlexaResponse('I\'m sorry, I didn\'t understand that request.')
    }

  } catch (error) {
    console.error('=== ALEXA WEBHOOK ERROR ===')
    console.error('Error:', error)
    console.error('Stack:', error.stack)
    
    return createAlexaResponse('I\'m sorry, there was an error processing your request.')
  }
})

function handleLaunchRequest(requestBody: any) {
  console.log('Handling launch request')
  
  const accessToken = requestBody.context?.System?.user?.accessToken
  
  if (!accessToken) {
    // User needs to link their account
    return createAccountLinkingResponse()
  }
  
  return createAlexaResponse(
    'Welcome to your Health and Productivity Assistant! You can ask me about your tasks, routines, or health data. What would you like to know?'
  )
}

async function handleIntentRequest(requestBody: any, supabase: any, accessToken?: string) {
  const intentName = requestBody.request?.intent?.name
  const slots = requestBody.request?.intent?.slots || {}
  
  console.log('Intent:', intentName)
  console.log('Slots:', JSON.stringify(slots, null, 2))

  if (!accessToken) {
    return createAccountLinkingResponse()
  }

  // Get user profile from access token
  const userProfile = await getUserProfile(supabase, accessToken)
  if (!userProfile) {
    return createAlexaResponse('I couldn\'t find your account. Please check your account linking.')
  }

  switch (intentName) {
    case 'GetTasksIntent':
      return await handleGetTasks(supabase, userProfile.user_id)
    
    case 'CreateTaskIntent':
      const taskName = slots.TaskName?.value
      if (taskName) {
        return await handleCreateTask(supabase, userProfile.user_id, taskName)
      }
      return createAlexaResponse('What task would you like me to create?')
    
    case 'GetHealthDataIntent':
      return await handleGetHealthData(supabase, userProfile.user_id)
    
    case 'GetRoutinesIntent':
      return await handleGetRoutines(supabase, userProfile.user_id)
    
    case 'AMAZON.HelpIntent':
      return createAlexaResponse(
        'You can ask me about your tasks, create new tasks, check your health data, or ask about your routines. For example, say "What are my tasks today?" or "Create a task to call mom".'
      )
    
    case 'AMAZON.StopIntent':
    case 'AMAZON.CancelIntent':
      return createAlexaResponse('Goodbye!', true)
    
    default:
      return createAlexaResponse('I\'m not sure how to help with that. Try asking about your tasks, health data, or routines.')
  }
}

function handleSessionEndedRequest(requestBody: any) {
  console.log('Session ended:', requestBody.request?.reason)
  // Just return an empty response for session ended
  return new Response('', { status: 204 })
}

async function getUserProfile(supabase: any, accessToken: string) {
  try {
    // For simplified approach, we'll use the first active Alexa configuration
    // In production, you'd match the Alexa user ID to your user
    const { data: config, error } = await supabase
      .from('api_configurations')
      .select('user_id')
      .eq('service_name', 'alexa')
      .eq('is_active', true)
      .limit(1)
      .single()
    
    if (error || !config) {
      console.log('No active Alexa user found:', error)
      return null
    }
    
    return config
  } catch (error) {
    console.error('Error getting user profile:', error)
    return null
  }
}

async function handleGetTasks(supabase: any, userId: string) {
  try {
    // Get today's tasks
    const today = new Date().toISOString().split('T')[0]
    
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('title, status, due_date')
      .eq('created_by', userId)
      .gte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(5)
    
    if (error) {
      console.error('Error fetching tasks:', error)
      return createAlexaResponse('I had trouble getting your tasks.')
    }
    
    if (!tasks || tasks.length === 0) {
      return createAlexaResponse('You have no upcoming tasks. Great job staying on top of things!')
    }
    
    const pendingTasks = tasks.filter(task => task.status === 'pending')
    
    if (pendingTasks.length === 0) {
      return createAlexaResponse('All your upcoming tasks are completed. Well done!')
    }
    
    const taskList = pendingTasks.slice(0, 3).map(task => task.title).join(', ')
    const responseText = `You have ${pendingTasks.length} pending task${pendingTasks.length > 1 ? 's' : ''}. Here are your top items: ${taskList}.`
    
    return createAlexaResponse(responseText)
    
  } catch (error) {
    console.error('Error in handleGetTasks:', error)
    return createAlexaResponse('I had trouble accessing your tasks.')
  }
}

async function handleCreateTask(supabase: any, userId: string, taskName: string) {
  try {
    const { error } = await supabase
      .from('tasks')
      .insert({
        created_by: userId,
        title: taskName,
        due_date: new Date().toISOString(),
        status: 'pending'
      })
    
    if (error) {
      console.error('Error creating task:', error)
      return createAlexaResponse('I had trouble creating that task.')
    }
    
    return createAlexaResponse(`I've created the task "${taskName}" for you.`)
    
  } catch (error) {
    console.error('Error in handleCreateTask:', error)
    return createAlexaResponse('I had trouble creating that task.')
  }
}

async function handleGetHealthData(supabase: any, userId: string) {
  try {
    // Get recent health data
    const { data: healthData, error } = await supabase
      .from('health_data')
      .select('data_type, value, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error('Error fetching health data:', error)
      return createAlexaResponse('I had trouble getting your health data.')
    }
    
    if (!healthData || healthData.length === 0) {
      return createAlexaResponse('I don\'t see any recent health data. Make sure your fitness tracker is synced.')
    }
    
    // Group by data type and get latest values
    const latestData: { [key: string]: number } = {}
    healthData.forEach(item => {
      if (!latestData[item.data_type]) {
        latestData[item.data_type] = item.value
      }
    })
    
    const dataPoints = Object.entries(latestData).map(([type, value]) => {
      switch (type) {
        case 'steps':
          return `${Math.round(value)} steps`
        case 'calories':
          return `${Math.round(value)} calories burned`
        case 'weight':
          return `${value} pounds`
        case 'sleep':
          return `${Math.round(value / 60)} hours of sleep`
        default:
          return `${type}: ${value}`
      }
    }).slice(0, 3).join(', ')
    
    return createAlexaResponse(`Here's your recent health data: ${dataPoints}.`)
    
  } catch (error) {
    console.error('Error in handleGetHealthData:', error)
    return createAlexaResponse('I had trouble accessing your health data.')
  }
}

async function handleGetRoutines(supabase: any, userId: string) {
  try {
    const { data: routines, error } = await supabase
      .from('routines')
      .select('title, routine_type')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(5)
    
    if (error) {
      console.error('Error fetching routines:', error)
      return createAlexaResponse('I had trouble getting your routines.')
    }
    
    if (!routines || routines.length === 0) {
      return createAlexaResponse('You don\'t have any active routines set up.')
    }
    
    const routineList = routines.map(routine => `${routine.title} (${routine.routine_type})`).join(', ')
    return createAlexaResponse(`Your active routines are: ${routineList}.`)
    
  } catch (error) {
    console.error('Error in handleGetRoutines:', error)
    return createAlexaResponse('I had trouble accessing your routines.')
  }
}

function createAlexaResponse(speechText: string, shouldEndSession = false) {
  const response = {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: speechText
      },
      shouldEndSession: shouldEndSession
    }
  }
  
  console.log('Alexa response:', JSON.stringify(response, null, 2))
  
  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
}

function createAccountLinkingResponse() {
  const response = {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: 'Please link your account using the Alexa app to get started.'
      },
      card: {
        type: 'LinkAccount'
      },
      shouldEndSession: true
    }
  }
  
  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
}