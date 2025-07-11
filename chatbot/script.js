const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");
const themeToggleInput = document.querySelector("#theme-toggle-input");
const newChatBtn = document.querySelector(".new-chat"); // Add this line to fix the error
// API Setup
const API_KEY = "YOUR API KEY";
const API_URL = `YOUR URL`;
let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };
// Set initial theme from local storage
const isLightTheme = localStorage.getItem("theme") === "light" || 
                    localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);

// Handle theme toggling - conditionally use either the button or input checkbox
if (themeToggleBtn) {
  // Using the old button-based theme toggle
  themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";
  
  themeToggleBtn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-theme");
    localStorage.setItem("themeColor", isLight ? "light_mode" : "dark_mode");
    themeToggleBtn.textContent = isLight ? "dark_mode" : "light_mode";
  });
} else if (themeToggleInput) {
  // Using the new checkbox-based theme toggle
  themeToggleInput.checked = isLightTheme;
  
  themeToggleInput.addEventListener("change", () => {
    document.body.classList.toggle("light-theme");
    localStorage.setItem("theme", themeToggleInput.checked ? "light" : "dark");
  });
}

// Function to create message elements
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};
// Scroll to the bottom of the container
const scrollToBottom = () => container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
// Simulate typing effect for bot responses
const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = "";
  const words = text.split(" ");
  let wordIndex = 0;
  // Set an interval to type each word
  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
    }
  }, 40); // 40 ms delay
};
// Make the API call and generate the bot's response
const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();
  // Add user message and file data to the chat history
  chatHistory.push({
    role: "user",
    parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])],
  });
  try {
    // Send the chat history to the API to get a response
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);
    // Process the response text and display with typing effect
    const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
    typingEffect(responseText, textElement, botMsgDiv);
    chatHistory.push({ role: "model", parts: [{ text: responseText }] });
    
    // Save chat history after generating response
    setTimeout(() => saveChatHistoryToLocalStorage(), 500);
  } catch (error) {
    textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : error.message;
    textElement.style.color = "#d62939";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    scrollToBottom();
  } finally {
    userData.file = {};
  }
};
// Handle the form submission
const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;
  userData.message = userMessage;
  promptInput.value = "";
  document.body.classList.add("chats-active", "bot-responding");
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
  // Generate user message HTML with optional file attachment
  const userMsgHTML = `
    <p class="message-text"></p>
    ${userData.file.data ? (userData.file.isImage ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />` : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}
  `;
  const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userData.message;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();
  setTimeout(() => {
    // Generate bot message HTML and add in the chat container
    // Update the image source to use a more reliable image path
    const botMsgHTML = `<img class="avatar" src="profile-icon-design-free-vector.jpg" alt="Bot" /> <p class="message-text">Just a sec...</p>`;
    const botMsgDiv = createMessageElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
    
    // Save chat history after getting a response
    setTimeout(() => {
      if (!document.body.classList.contains("bot-responding")) {
        saveChatHistoryToLocalStorage();
      }
    }, 1000);
  }, 600); // 600 ms delay
};

// Chat history management
const saveChatHistoryToLocalStorage = () => {
  // Only save if there are messages
  if (chatHistory.length === 0) return;
  
  const chatHistories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
  
  // Create a unique ID for the current chat
  const chatId = Date.now().toString();
  
  // Create chat object
  const currentChat = {
    id: chatId,
    timestamp: new Date().toISOString(),
    messages: JSON.parse(JSON.stringify(chatHistory)), // Deep copy to avoid reference issues
    title: chatHistory.length > 0 ? chatHistory[0].parts[0].text.slice(0, 30) + '...' : 'New Chat'
  };
  
  // Check if we already have this chat in history (prevent duplicates)
  const existingChatIndex = chatHistories.findIndex(chat => 
    chat.messages.length > 0 && 
    chatHistory.length > 0 && 
    chat.messages[0].parts[0].text === chatHistory[0].parts[0].text
  );
  
  if (existingChatIndex !== -1) {
    // Update existing chat instead of creating a new one
    chatHistories[existingChatIndex] = currentChat;
  } else {
    // Add current chat to the beginning of the list
    chatHistories.unshift(currentChat);
  }
  
  // Keep only the 10 most recent chat histories
  const trimmedHistories = chatHistories.slice(0, 10);
  localStorage.setItem('chatHistories', JSON.stringify(trimmedHistories));
  
  // Update the chat history list in the sidebar
  updateChatHistoryList();
};

const loadChatHistory = (chatId) => {
  const chatHistories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
  const selectedChat = chatHistories.find(chat => chat.id === chatId);
  
  if (selectedChat) {
    // Clear current chat history and load the selected one
    chatHistory.length = 0;
    selectedChat.messages.forEach(msg => chatHistory.push(msg));
    
    // Display the loaded messages in the UI
    displayLoadedChatHistory();
    
    // Make the chat active
    document.body.classList.add("chats-active");
  }
};

const displayLoadedChatHistory = () => {
  // Clear current chat container
  chatsContainer.innerHTML = "";
  
  // Display each message in the chat history
  for (let i = 0; i < chatHistory.length; i++) {
    const message = chatHistory[i];
    
    if (message.role === "user") {
      // Display user message
      const userMsgHTML = `<p class="message-text"></p>`;
      const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
      userMsgDiv.querySelector(".message-text").textContent = message.parts[0].text;
      chatsContainer.appendChild(userMsgDiv);
    } else if (message.role === "model") {
      // Display bot message - update image source here too
      const botMsgHTML = `<img class="avatar" src="profile-icon-design-free-vector.jpg" alt="Bot" /> <p class="message-text"></p>`;
      const botMsgDiv = createMessageElement(botMsgHTML, "bot-message");
      botMsgDiv.querySelector(".message-text").textContent = message.parts[0].text;
      chatsContainer.appendChild(botMsgDiv);
    }
  }
  
  // Scroll to the bottom
  scrollToBottom();
};

const updateChatHistoryList = () => {
  // Get the chat history list element
  const historyList = document.querySelector('.history-list');
  if (!historyList) return;
  
  // Clear the existing list
  historyList.innerHTML = '';
  
  // Get chat histories from localStorage
  const chatHistories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
  
  // Add each chat to the list
  chatHistories.forEach(chat => {
    const chatItem = document.createElement('button');
    chatItem.className = 'feature-btn';
    chatItem.innerHTML = `
      <span class="material-symbols-rounded">chat</span>
      ${chat.title}
    `;
    
    // Add click event to load this chat
    chatItem.addEventListener('click', () => {
      loadChatHistory(chat.id);
    });
    
    historyList.appendChild(chatItem);
  });
};

// Stop Bot Response
document.querySelector("#stop-response-btn").addEventListener("click", () => {
  controller?.abort();
  userData.file = {};
  clearInterval(typingInterval);
  chatsContainer.querySelector(".bot-message.loading").classList.remove("loading");
  document.body.classList.remove("bot-responding");
});

// Enhanced New Chat functionality
newChatBtn.addEventListener("click", () => {
  // Save current chat if it has content
  if (chatHistory.length > 0) {
    saveChatHistoryToLocalStorage();
  }
  
  // Clear chat history array completely
  chatHistory.length = 0;
  
  // Clear UI
  chatsContainer.innerHTML = "";
  document.body.classList.remove("chats-active", "bot-responding");
  
  // Clear input and any attachments
  promptInput.value = "";
  userData.file = {};
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
  
  // Update chat history list without saving the empty chat
  updateChatHistoryList();
});

// Delete all chats (enhanced)
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
  if (confirm("Are you sure you want to delete this chat?")) {
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("chats-active", "bot-responding");
    
    // Update local storage - remove current chat
    const chatHistories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
    if (chatHistories.length > 0) {
      chatHistories.shift(); // Remove the first (current) chat
      localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
      updateChatHistoryList();
    }
  }
});

// Load chat history list when the page loads
document.addEventListener('DOMContentLoaded', () => {
  updateChatHistoryList();
});

// Add event listeners for form submission and file input click
promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());

// Handle suggestions click
document.querySelectorAll(".suggestions-item").forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    promptInput.value = suggestion.querySelector(".text").textContent;
    promptForm.dispatchEvent(new Event("submit"));
  });
});

// Show/hide controls for mobile on prompt input focus
document.addEventListener("click", ({ target }) => {
  const wrapper = document.querySelector(".prompt-wrapper");
  const shouldHide = target.classList.contains("prompt-input") || (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn" || target.id === "stop-response-btn"));
  wrapper.classList.toggle("hide-controls", shouldHide);
});
