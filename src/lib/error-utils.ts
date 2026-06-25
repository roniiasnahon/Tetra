export function getUserFriendlyErrorMessage(err: any): string {
  if (!err) return "An unexpected error occurred. Please try again.";

  let message = "";
  if (typeof err === "string") {
    message = err;
  } else if (err.message) {
    message = err.message;
  } else if (err.error) {
    message = err.error;
  } else {
    try {
      message = JSON.stringify(err);
    } catch (e) {
      message = "Unknown error occurred.";
    }
  }

  const lowerMessage = message.toLowerCase();

  // Firebase / Auth specific errors
  if (lowerMessage.includes("auth/invalid-credential") || lowerMessage.includes("wrong-password") || lowerMessage.includes("user-not-found")) {
    return "We couldn't find an account matching that email and password. Please check your details and try again.";
  }
  if (lowerMessage.includes("auth/email-already-in-use")) {
    return "An account with this email address already exists. Try signing in instead.";
  }
  if (lowerMessage.includes("auth/invalid-email")) {
    return "That email address doesn't look quite right. Please check for any typos.";
  }
  if (lowerMessage.includes("auth/operation-not-allowed")) {
    return "This sign-in method is currently undergoing updates. Please try again later or contact support.";
  }
  if (lowerMessage.includes("auth/weak-password")) {
    return "For your security, please choose a stronger password with at least 6 characters.";
  }
  if (lowerMessage.includes("auth/too-many-requests")) {
    return "We've blocked all requests from this device due to unusual activity. Try again later.";
  }
  if (lowerMessage.includes("auth/requires-recent-login")) {
    return "For your security, this action requires you to have logged in recently. Please log out and log back in, then try again.";
  }
  
  // Specific Google API errors related to identity toolkit
  if (lowerMessage.includes("identity toolkit api has not been used") || lowerMessage.includes("identitytoolkit.googleapis.com")) {
    return "Our authentication service is currently unconfigured or temporarily unavailable. Please try again later.";
  }
  if (lowerMessage.includes("missing or insufficient permissions")) {
    return "You do not have permission to perform this action.";
  }
  if (lowerMessage.includes("failed to fetch") || lowerMessage.includes("network error")) {
    return "We couldn't connect to our servers. Please check your internet connection and try again.";
  }
  if (lowerMessage.includes("api key not valid") || lowerMessage.includes("api_key_invalid")) {
    return "Our authentication service is experiencing configuration issues. Please try again later.";
  }
  
  // Clean up any remaining JSON or raw errors by avoiding returning them directly
  if (message.includes("{") || message.includes("}")) {
     return "An unexpected server error occurred. Please try again in a moment.";
  }

  // If it's a relatively short message that doesn't look like raw code, return it, otherwise fallback
  if (message.length < 100 && !message.includes("//") && !message.includes("http")) {
      return message;
  }

  return "We ran into an unexpected issue. Please try again in a moment.";
}
