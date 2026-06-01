import posthog from "posthog-js" 
 
export function initPostHog() { 
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, { 
      autocapture: true, 
      capture_pageview: true, 
      persistence: "localStorage", 
    }) 
  } 
} 
 
export function identifyUser(userId, properties) { 
  posthog.identify(userId, properties) 
} 
 
export function setUser(userId, email) { 
  posthog.identify(userId, { email }) 
} 
