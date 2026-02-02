package com.citi.copilotautomation.bridge

import com.citi.copilotautomation.core.ComponentFinder
import com.citi.copilotautomation.core.ReflectionUtil
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.WindowManager
import java.awt.Component

/**
 * Utility for interacting with the Copilot Chat tool window UI.
 * Handles mode switching, model selection, and session management.
 */
object CopilotChatToolWindowUtil {
    private val LOG = Logger.getInstance(CopilotChatToolWindowUtil::class.java)

    // =========================================================================
    // Window/Panel Access
    // =========================================================================

    private fun getRootComponent(frame: Any): Component? {
        return ReflectionUtil.invokeMethod(frame, "getComponent") as? Component
            ?: frame as? Component
    }

    private fun getCopilotChatPanel(project: Project): Component? {
        val frame = WindowManager.getInstance().getIdeFrame(project)
        if (frame == null) {
            LOG.warn("getCopilotChatPanel: IDE frame not found for project")
            return null
        }

        val root = getRootComponent(frame)
        if (root == null) {
            LOG.warn("getCopilotChatPanel: Root component not found")
            return null
        }

        return ComponentFinder.findFirstByClassName(root, CopilotClassNames.CHAT_TOOL_WINDOW_CONTAINER)
    }

    private fun activateCopilotChatToolWindow(project: Project): Boolean {
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(CopilotClassNames.TOOL_WINDOW_ID)
        if (toolWindow == null) {
            LOG.warn("activateCopilotChatToolWindow: '${CopilotClassNames.TOOL_WINDOW_ID}' tool window not found.")
            return false
        }
        if (!toolWindow.isActive) {
            toolWindow.activate(null)
            LOG.debug("activateCopilotChatToolWindow: Tool window activated.")
        }
        return true
    }

    /**
     * Get the tool window component for external use.
     */
    fun getToolWindowComponent(project: Project): Component? {
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(CopilotClassNames.TOOL_WINDOW_ID)
        return toolWindow?.component
    }

    // =========================================================================
    // Generic Action Button Helper
    // =========================================================================

    /**
     * Find and click a button with a specific action class.
     */
    private fun clickActionButton(project: Project, actionClassName: String, actionDescription: String): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.error("clickActionButton($actionDescription): Failed to activate tool window")
            return false
        }

        val chatPanel = getCopilotChatPanel(project)
        if (chatPanel == null) {
            LOG.error("clickActionButton($actionDescription): Chat panel not found")
            return false
        }

        val button = ComponentFinder.findButtonWithAction(
            chatPanel,
            CopilotClassNames.KEYBOARD_ACCESSIBLE_ACTION_BUTTON,
            actionClassName
        )

        if (button != null) {
            if (ReflectionUtil.click(button)) {
                LOG.debug("clickActionButton($actionDescription): Successfully clicked button")
                return true
            }
            LOG.error("clickActionButton($actionDescription): Failed to invoke click()")
            return false
        }

        LOG.warn("clickActionButton($actionDescription): No visible button found with action $actionClassName")
        return false
    }

    // =========================================================================
    // Send Prompt
    // =========================================================================

    fun sendPromptToCopilot(project: Project): Boolean {
        return clickActionButton(project, CopilotClassNames.SEND_MESSAGE_ACTION, "SendMessage")
    }

    // =========================================================================
    // Session Management
    // =========================================================================

    fun startNewAgentSession(project: Project): Boolean {
        return clickActionButton(project, CopilotClassNames.NEW_AGENT_SESSION_ACTION, "NewAgentSession")
    }

    // =========================================================================
    // Chat Mode Selection (Ask/Agent)
    // =========================================================================

    /**
     * Select a chat mode by matching its display name.
     * The ChatModeComboBox uses ChatModeItem$Mode objects.
     */
    private fun selectChatModeByName(project: Project, modeName: String): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.warn("selectChatModeByName: Failed to activate tool window")
            return false
        }

        // Try to find ChatModeComboBox using all known class name variants
        val toolWindowComponent = getToolWindowComponent(project)
        val chatPanel = getCopilotChatPanel(project)
        var comboBox: Component? = null

        for (className in CopilotClassNames.CHAT_MODE_COMBO_BOX_VARIANTS) {
            if (toolWindowComponent != null) {
                comboBox = ComponentFinder.findFirstByClassName(toolWindowComponent, className)
                if (comboBox != null) {
                    LOG.info("selectChatModeByName: Found combo box with class $className")
                    break
                }
            }
            if (chatPanel != null) {
                comboBox = ComponentFinder.findFirstByClassName(chatPanel, className)
                if (comboBox != null) {
                    LOG.info("selectChatModeByName: Found combo box with class $className")
                    break
                }
            }
        }

        if (comboBox == null) {
            LOG.warn("selectChatModeByName: ChatModeComboBox not found (tried: ${CopilotClassNames.CHAT_MODE_COMBO_BOX_VARIANTS})")
            return false
        }

        LOG.info("selectChatModeByName: Looking for mode '$modeName'")

        // Find the item that matches the name
        val itemCount = ReflectionUtil.getItemCount(comboBox)
        if (itemCount <= 0) {
            LOG.warn("selectChatModeByName: No items in combo box")
            return false
        }

        for (i in 0 until itemCount) {
            val item = ReflectionUtil.getItemAt(comboBox, i) ?: continue
            val itemName = getItemDisplayName(item)

            LOG.debug("selectChatModeByName: Item $i = '$itemName'")

            if (itemName.equals(modeName, ignoreCase = true) || itemName.contains(modeName, ignoreCase = true)) {
                LOG.info("selectChatModeByName: Found '$modeName' at index $i (name: '$itemName')")
                return selectChatModeItem(comboBox, item, i)
            }
        }

        LOG.warn("selectChatModeByName: Mode '$modeName' not found in combo box")
        return false
    }

    /**
     * Get the display name and ChatMode from a combo box item.
     * ChatModeItem$Mode has getMode() which returns a ChatMode with id/name properties.
     */
    private fun getItemDisplayName(item: Any): String {
        // For ChatModeItem$Mode, get the ChatMode and extract its name
        try {
            val chatMode = item.javaClass.getMethod("getMode").invoke(item)
            if (chatMode != null) {
                // Try to get name or id from ChatMode
                for (methodName in listOf("getName", "getId", "name", "id")) {
                    try {
                        val result = chatMode.javaClass.getMethod(methodName).invoke(chatMode)
                        if (result != null && result.toString().isNotBlank()) {
                            return result.toString()
                        }
                    } catch (e: Exception) {
                        // Try next
                    }
                }
                // Try fields
                for (fieldName in listOf("name", "id")) {
                    try {
                        val field = chatMode.javaClass.getDeclaredField(fieldName)
                        field.isAccessible = true
                        val value = field.get(chatMode)
                        if (value != null && value.toString().isNotBlank()) {
                            return value.toString()
                        }
                    } catch (e: Exception) {
                        // Try next
                    }
                }
            }
        } catch (e: Exception) {
            LOG.debug("getItemDisplayName: getMode() failed: ${e.message}")
        }

        // Fallback to standard methods
        for (methodName in listOf("getName", "getDisplayName", "getText", "name", "getTitle", "getLabel")) {
            try {
                val result = item.javaClass.getMethod(methodName).invoke(item)
                if (result != null && result.toString().isNotBlank()) {
                    return result.toString()
                }
            } catch (e: Exception) {
                // Try next method
            }
        }

        return item.toString()
    }

    /**
     * Get the ChatMode object from a ChatModeItem$Mode.
     */
    private fun getChatModeFromItem(item: Any): Any? {
        return try {
            item.javaClass.getMethod("getMode").invoke(item)
        } catch (e: Exception) {
            LOG.debug("getChatModeFromItem: getMode() failed: ${e.message}")
            null
        }
    }

    /**
     * Select a specific item in the chat mode combo box by simulating a click.
     */
    private fun selectChatModeItem(comboBox: Component, item: Any, index: Int): Boolean {
        LOG.info("selectChatModeItem: Selecting item at index $index via simulated click")

        // Simulate clicking the combo box to open the popup, then select the item
        return simulateComboBoxSelection(comboBox, index)
    }

    /**
     * Simulate a real combo box selection by clicking to open and selecting the item.
     */
    private fun simulateComboBoxSelection(comboBox: Component, index: Int): Boolean {
        try {
            // Step 1: Click the combo box to open the popup
            LOG.info("simulateComboBoxSelection: Clicking combo box to open popup")
            simulateMouseClick(comboBox)

            // Give the popup time to appear
            Thread.sleep(200)

            // Step 2: Find the popup's list (MyList or JList)
            val popupList = findPopupList()
            if (popupList != null) {
                LOG.info("simulateComboBoxSelection: Found popup list (${popupList.javaClass.simpleName}), clicking item at index $index")

                // Get cell bounds for the item
                val cellBounds = if (popupList is javax.swing.JList<*>) {
                    popupList.getCellBounds(index, index)
                } else {
                    // Try reflection for MyList or other custom lists
                    try {
                        popupList.javaClass.getMethod("getCellBounds", Int::class.java, Int::class.java)
                            .invoke(popupList, index, index) as? java.awt.Rectangle
                    } catch (e: Exception) {
                        LOG.debug("Could not get cell bounds via reflection: ${e.message}")
                        null
                    }
                }

                if (cellBounds != null) {
                    val clickX = cellBounds.x + cellBounds.width / 2
                    val clickY = cellBounds.y + cellBounds.height / 2

                    LOG.info("simulateComboBoxSelection: Clicking at ($clickX, $clickY) for index $index")

                    // Dispatch MOUSE_PRESSED
                    val pressEvent = java.awt.event.MouseEvent(
                        popupList,
                        java.awt.event.MouseEvent.MOUSE_PRESSED,
                        System.currentTimeMillis(),
                        java.awt.event.InputEvent.BUTTON1_DOWN_MASK,
                        clickX, clickY,
                        1, false, java.awt.event.MouseEvent.BUTTON1
                    )
                    popupList.dispatchEvent(pressEvent)

                    Thread.sleep(50)

                    // Dispatch MOUSE_RELEASED - this triggers the selection
                    val releaseEvent = java.awt.event.MouseEvent(
                        popupList,
                        java.awt.event.MouseEvent.MOUSE_RELEASED,
                        System.currentTimeMillis(),
                        0,
                        clickX, clickY,
                        1, false, java.awt.event.MouseEvent.BUTTON1
                    )
                    popupList.dispatchEvent(releaseEvent)

                    LOG.info("simulateComboBoxSelection: Dispatched mouse press/release to popup list")
                    return true
                } else {
                    LOG.warn("simulateComboBoxSelection: Could not get cell bounds for index $index")
                }
            }

            // Fallback: Try using keyboard navigation on the combo box
            LOG.info("simulateComboBoxSelection: No popup list found, trying keyboard selection")
            return selectViaKeyboard(comboBox, index)

        } catch (e: Exception) {
            LOG.warn("simulateComboBoxSelection: Failed: ${e.message}", e)
            return false
        }
    }

    /**
     * Find the popup list component (MyList, JList, or similar).
     */
    private fun findPopupList(): Component? {
        for (window in java.awt.Window.getWindows()) {
            if (window.isVisible) {
                val list = findListComponentInContainer(window)
                if (list != null) {
                    LOG.debug("findPopupList: Found ${list.javaClass.simpleName} in ${window.javaClass.simpleName}")
                    return list
                }
            }
        }
        return null
    }

    /**
     * Recursively find a list component (MyList, JList, etc.) in a container.
     */
    private fun findListComponentInContainer(container: java.awt.Container): Component? {
        for (comp in container.components) {
            // Check for MyList or any JList
            val className = comp.javaClass.simpleName
            if (className == "MyList" || comp is javax.swing.JList<*>) {
                return comp
            }
            // Check class name contains "List" but not "Listener"
            if (className.contains("List") && !className.contains("Listener")) {
                return comp
            }
            if (comp is java.awt.Container) {
                val found = findListComponentInContainer(comp)
                if (found != null) return found
            }
        }
        return null
    }

    /**
     * Press Enter key on a component to confirm selection.
     */
    private fun pressEnterOnComponent(component: Component) {
        // KEY_PRESSED
        val pressEvent = java.awt.event.KeyEvent(
            component,
            java.awt.event.KeyEvent.KEY_PRESSED,
            System.currentTimeMillis(),
            0,
            java.awt.event.KeyEvent.VK_ENTER,
            '\n'
        )
        component.dispatchEvent(pressEvent)

        // KEY_TYPED
        val typedEvent = java.awt.event.KeyEvent(
            component,
            java.awt.event.KeyEvent.KEY_TYPED,
            System.currentTimeMillis(),
            0,
            java.awt.event.KeyEvent.VK_UNDEFINED,
            '\n'
        )
        component.dispatchEvent(typedEvent)

        // KEY_RELEASED
        val releaseEvent = java.awt.event.KeyEvent(
            component,
            java.awt.event.KeyEvent.KEY_RELEASED,
            System.currentTimeMillis(),
            0,
            java.awt.event.KeyEvent.VK_ENTER,
            '\n'
        )
        component.dispatchEvent(releaseEvent)

        LOG.debug("pressEnterOnComponent: Dispatched Enter key events to ${component.javaClass.simpleName}")
    }

    /**
     * Fire actionPerformed on the combo box to trigger listeners.
     */
    private fun fireActionPerformed(comboBox: Component) {
        // Try to get action listeners and invoke them
        try {
            val listeners = comboBox.javaClass.getMethod("getActionListeners").invoke(comboBox) as? Array<*>
            if (listeners != null && listeners.isNotEmpty()) {
                val event = java.awt.event.ActionEvent(
                    comboBox,
                    java.awt.event.ActionEvent.ACTION_PERFORMED,
                    "comboBoxChanged",
                    System.currentTimeMillis(),
                    0
                )
                for (listener in listeners) {
                    try {
                        listener?.javaClass?.getMethod("actionPerformed", java.awt.event.ActionEvent::class.java)
                            ?.invoke(listener, event)
                    } catch (e: Exception) {
                        // Continue
                    }
                }
                LOG.info("fireActionPerformed: Invoked ${listeners.size} listeners")
            }
        } catch (e: Exception) {
            LOG.debug("fireActionPerformed: Failed: ${e.message}")
        }
    }

    /**
     * Find the JList inside the combo box popup.
     */
    private fun findPopupJList(): javax.swing.JList<*>? {
        for (window in java.awt.Window.getWindows()) {
            if (window.isVisible) {
                val list = findJListInContainer(window)
                if (list != null) {
                    LOG.debug("findPopupJList: Found JList in ${window.javaClass.simpleName}")
                    return list
                }
            }
        }
        return null
    }

    /**
     * Recursively find a JList in a container.
     */
    private fun findJListInContainer(container: java.awt.Container): javax.swing.JList<*>? {
        for (comp in container.components) {
            if (comp is javax.swing.JList<*>) {
                return comp
            }
            if (comp is java.awt.Container) {
                val found = findJListInContainer(comp)
                if (found != null) return found
            }
        }
        return null
    }

    /**
     * Hide the combo box popup to commit the selection.
     */
    private fun hideComboBoxPopup(comboBox: Component) {
        // Try hidePopup() method
        try {
            comboBox.javaClass.getMethod("hidePopup").invoke(comboBox)
            LOG.debug("hideComboBoxPopup: hidePopup() succeeded")
            return
        } catch (e: Exception) {
            LOG.debug("hideComboBoxPopup: hidePopup() failed: ${e.message}")
        }

        // Try setPopupVisible(false)
        try {
            comboBox.javaClass.getMethod("setPopupVisible", Boolean::class.java).invoke(comboBox, false)
            LOG.debug("hideComboBoxPopup: setPopupVisible(false) succeeded")
            return
        } catch (e: Exception) {
            LOG.debug("hideComboBoxPopup: setPopupVisible(false) failed: ${e.message}")
        }

        // Press Escape to close popup
        pressEscapeKey(comboBox)
    }

    /**
     * Press Escape key on a component.
     */
    private fun pressEscapeKey(component: Component) {
        val escPress = java.awt.event.KeyEvent(
            component,
            java.awt.event.KeyEvent.KEY_PRESSED,
            System.currentTimeMillis(),
            0,
            java.awt.event.KeyEvent.VK_ESCAPE,
            java.awt.event.KeyEvent.CHAR_UNDEFINED
        )
        val escRelease = java.awt.event.KeyEvent(
            component,
            java.awt.event.KeyEvent.KEY_RELEASED,
            System.currentTimeMillis(),
            0,
            java.awt.event.KeyEvent.VK_ESCAPE,
            java.awt.event.KeyEvent.CHAR_UNDEFINED
        )
        component.dispatchEvent(escPress)
        component.dispatchEvent(escRelease)
        LOG.debug("pressEscapeKey: Dispatched Escape key")
    }

    /**
     * Click directly on an item in the popup list at the given index.
     */
    private fun clickPopupItemAtIndex(popup: Component, index: Int) {
        if (popup is javax.swing.JList<*>) {
            // For JList, we can get the cell bounds and click on it
            val cellBounds = popup.getCellBounds(index, index)
            if (cellBounds != null) {
                val clickX = cellBounds.x + cellBounds.width / 2
                val clickY = cellBounds.y + cellBounds.height / 2

                LOG.info("clickPopupItemAtIndex: Clicking JList at ($clickX, $clickY) for index $index")

                val pressEvent = java.awt.event.MouseEvent(
                    popup,
                    java.awt.event.MouseEvent.MOUSE_PRESSED,
                    System.currentTimeMillis(),
                    java.awt.event.InputEvent.BUTTON1_DOWN_MASK,
                    clickX, clickY,
                    1, false, java.awt.event.MouseEvent.BUTTON1
                )
                val releaseEvent = java.awt.event.MouseEvent(
                    popup,
                    java.awt.event.MouseEvent.MOUSE_RELEASED,
                    System.currentTimeMillis(),
                    0,
                    clickX, clickY,
                    1, false, java.awt.event.MouseEvent.BUTTON1
                )
                val clickEvent = java.awt.event.MouseEvent(
                    popup,
                    java.awt.event.MouseEvent.MOUSE_CLICKED,
                    System.currentTimeMillis(),
                    0,
                    clickX, clickY,
                    1, false, java.awt.event.MouseEvent.BUTTON1
                )

                popup.dispatchEvent(pressEvent)
                popup.dispatchEvent(releaseEvent)
                popup.dispatchEvent(clickEvent)
                return
            }
        }

        // For non-JList popups, estimate item position
        val bounds = popup.bounds
        val itemCount = getListItemCount(popup)
        val itemHeight = bounds.height / maxOf(1, itemCount)
        val clickX = bounds.width / 2
        val clickY = (index * itemHeight) + (itemHeight / 2)

        LOG.info("clickPopupItemAtIndex: Clicking popup at ($clickX, $clickY) for index $index")

        val pressEvent = java.awt.event.MouseEvent(
            popup,
            java.awt.event.MouseEvent.MOUSE_PRESSED,
            System.currentTimeMillis(),
            java.awt.event.InputEvent.BUTTON1_DOWN_MASK,
            clickX, clickY,
            1, false, java.awt.event.MouseEvent.BUTTON1
        )
        val releaseEvent = java.awt.event.MouseEvent(
            popup,
            java.awt.event.MouseEvent.MOUSE_RELEASED,
            System.currentTimeMillis(),
            0,
            clickX, clickY,
            1, false, java.awt.event.MouseEvent.BUTTON1
        )
        val clickEvent = java.awt.event.MouseEvent(
            popup,
            java.awt.event.MouseEvent.MOUSE_CLICKED,
            System.currentTimeMillis(),
            0,
            clickX, clickY,
            1, false, java.awt.event.MouseEvent.BUTTON1
        )

        popup.dispatchEvent(pressEvent)
        popup.dispatchEvent(releaseEvent)
        popup.dispatchEvent(clickEvent)
    }

    /**
     * Press Enter key on a component.
     */
    private fun pressEnterKey(component: Component) {
        val enterPress = java.awt.event.KeyEvent(
            component,
            java.awt.event.KeyEvent.KEY_PRESSED,
            System.currentTimeMillis(),
            0,
            java.awt.event.KeyEvent.VK_ENTER,
            '\n'
        )
        val enterRelease = java.awt.event.KeyEvent(
            component,
            java.awt.event.KeyEvent.KEY_RELEASED,
            System.currentTimeMillis(),
            0,
            java.awt.event.KeyEvent.VK_ENTER,
            '\n'
        )
        component.dispatchEvent(enterPress)
        component.dispatchEvent(enterRelease)
        LOG.debug("pressEnterKey: Dispatched Enter key to ${component.javaClass.simpleName}")
    }

    /**
     * Simulate a mouse click on a component.
     */
    private fun simulateMouseClick(component: Component) {
        val bounds = component.bounds
        val centerX = bounds.width / 2
        val centerY = bounds.height / 2

        val pressEvent = java.awt.event.MouseEvent(
            component,
            java.awt.event.MouseEvent.MOUSE_PRESSED,
            System.currentTimeMillis(),
            java.awt.event.InputEvent.BUTTON1_DOWN_MASK,
            centerX, centerY,
            1, false, java.awt.event.MouseEvent.BUTTON1
        )

        val releaseEvent = java.awt.event.MouseEvent(
            component,
            java.awt.event.MouseEvent.MOUSE_RELEASED,
            System.currentTimeMillis(),
            0,
            centerX, centerY,
            1, false, java.awt.event.MouseEvent.BUTTON1
        )

        val clickEvent = java.awt.event.MouseEvent(
            component,
            java.awt.event.MouseEvent.MOUSE_CLICKED,
            System.currentTimeMillis(),
            0,
            centerX, centerY,
            1, false, java.awt.event.MouseEvent.BUTTON1
        )

        component.dispatchEvent(pressEvent)
        component.dispatchEvent(releaseEvent)
        component.dispatchEvent(clickEvent)

        LOG.debug("simulateMouseClick: Dispatched click events to ${component.javaClass.simpleName}")
    }

    /**
     * Find the popup menu/list for a combo box.
     */
    private fun findComboBoxPopup(): Component? {
        // Look for popup in all windows
        for (window in java.awt.Window.getWindows()) {
            if (window.isVisible && window is javax.swing.JWindow) {
                // Look for JList or similar in the popup
                val list = findListInContainer(window)
                if (list != null) {
                    LOG.debug("findComboBoxPopup: Found list in JWindow")
                    return list
                }
            }
            if (window.isVisible && window.javaClass.simpleName.contains("Popup")) {
                LOG.debug("findComboBoxPopup: Found popup window: ${window.javaClass.name}")
                val list = findListInContainer(window)
                if (list != null) return list
            }
        }

        // Also check for heavyweight popups
        for (window in java.awt.Window.getWindows()) {
            if (window.isVisible) {
                val list = findListInContainer(window)
                if (list != null && isComboBoxPopupList(list)) {
                    LOG.debug("findComboBoxPopup: Found combo popup list in ${window.javaClass.simpleName}")
                    return list
                }
            }
        }

        return null
    }

    /**
     * Check if a list component is a combo box popup list.
     */
    private fun isComboBoxPopupList(component: Component): Boolean {
        val className = component.javaClass.name.lowercase()
        return className.contains("combobox") || className.contains("popup") || className.contains("list")
    }

    /**
     * Find a JList or similar list component in a container.
     */
    private fun findListInContainer(container: java.awt.Container): Component? {
        for (comp in container.components) {
            if (comp is javax.swing.JList<*>) {
                return comp
            }
            if (comp.javaClass.simpleName.contains("List")) {
                return comp
            }
            if (comp is java.awt.Container) {
                val found = findListInContainer(comp)
                if (found != null) return found
            }
        }
        return null
    }

    /**
     * Select an item in a popup list.
     */
    private fun selectPopupItem(popup: Component, index: Int): Boolean {
        try {
            if (popup is javax.swing.JList<*>) {
                popup.selectedIndex = index
                // Simulate Enter key to confirm selection
                val enterEvent = java.awt.event.KeyEvent(
                    popup,
                    java.awt.event.KeyEvent.KEY_PRESSED,
                    System.currentTimeMillis(),
                    0,
                    java.awt.event.KeyEvent.VK_ENTER,
                    '\n'
                )
                popup.dispatchEvent(enterEvent)
                LOG.info("selectPopupItem: Selected index $index in JList")
                return true
            }

            // Try clicking on the item at the index
            val bounds = popup.bounds
            val itemHeight = bounds.height / maxOf(1, getListItemCount(popup))
            val clickY = (index * itemHeight) + (itemHeight / 2)

            val clickEvent = java.awt.event.MouseEvent(
                popup,
                java.awt.event.MouseEvent.MOUSE_CLICKED,
                System.currentTimeMillis(),
                0,
                bounds.width / 2, clickY,
                1, false, java.awt.event.MouseEvent.BUTTON1
            )
            popup.dispatchEvent(clickEvent)
            LOG.info("selectPopupItem: Clicked at y=$clickY in popup")
            return true

        } catch (e: Exception) {
            LOG.warn("selectPopupItem: Failed: ${e.message}")
            return false
        }
    }

    /**
     * Get item count from a list-like component.
     */
    private fun getListItemCount(list: Component): Int {
        return try {
            val method = list.javaClass.getMethod("getModel")
            val model = method.invoke(list)
            val sizeMethod = model.javaClass.getMethod("getSize")
            sizeMethod.invoke(model) as? Int ?: 3
        } catch (e: Exception) {
            3 // Default assumption
        }
    }

    /**
     * Select item using keyboard navigation (fallback).
     */
    private fun selectViaKeyboard(comboBox: Component, targetIndex: Int): Boolean {
        try {
            // Get current index
            val currentIndex = try {
                comboBox.javaClass.getMethod("getSelectedIndex").invoke(comboBox) as? Int ?: 0
            } catch (e: Exception) { 0 }

            // Calculate how many times to press up/down
            val diff = targetIndex - currentIndex

            if (diff == 0) {
                LOG.info("selectViaKeyboard: Already at target index")
                return true
            }

            val keyCode = if (diff > 0) java.awt.event.KeyEvent.VK_DOWN else java.awt.event.KeyEvent.VK_UP
            val steps = kotlin.math.abs(diff)

            LOG.info("selectViaKeyboard: Pressing ${if (diff > 0) "DOWN" else "UP"} $steps times")

            // Request focus
            comboBox.requestFocusInWindow()
            Thread.sleep(50)

            // Press arrow keys
            for (i in 0 until steps) {
                val keyPress = java.awt.event.KeyEvent(
                    comboBox,
                    java.awt.event.KeyEvent.KEY_PRESSED,
                    System.currentTimeMillis(),
                    0,
                    keyCode,
                    java.awt.event.KeyEvent.CHAR_UNDEFINED
                )
                val keyRelease = java.awt.event.KeyEvent(
                    comboBox,
                    java.awt.event.KeyEvent.KEY_RELEASED,
                    System.currentTimeMillis(),
                    0,
                    keyCode,
                    java.awt.event.KeyEvent.CHAR_UNDEFINED
                )
                comboBox.dispatchEvent(keyPress)
                comboBox.dispatchEvent(keyRelease)
                Thread.sleep(30)
            }

            // Press Enter to confirm
            val enterPress = java.awt.event.KeyEvent(
                comboBox,
                java.awt.event.KeyEvent.KEY_PRESSED,
                System.currentTimeMillis(),
                0,
                java.awt.event.KeyEvent.VK_ENTER,
                '\n'
            )
            comboBox.dispatchEvent(enterPress)

            LOG.info("selectViaKeyboard: Keyboard selection completed")
            return true

        } catch (e: Exception) {
            LOG.warn("selectViaKeyboard: Failed: ${e.message}")
            return false
        }
    }

    fun setAskChatMode(project: Project): Boolean {
        return selectChatModeByName(project, "Ask")
    }

    fun setAgentChatMode(project: Project): Boolean {
        return selectChatModeByName(project, "Agent")
    }

    // =========================================================================
    // Model Selection
    // =========================================================================

    /**
     * Select a model by matching its display name.
     * ModelPickPanel uses CopilotModelItem objects with toString() returning the name.
     */
    private fun selectModelByName(project: Project, modelName: String): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.warn("selectModelByName: Failed to activate tool window")
            return false
        }

        // Try tool window component first (more reliable)
        val toolWindowComponent = getToolWindowComponent(project)
        var modelPanel = if (toolWindowComponent != null) {
            ComponentFinder.findFirstByClassName(toolWindowComponent, CopilotClassNames.MODEL_PICK_PANEL)
        } else null

        // Fallback to chat panel
        if (modelPanel == null) {
            val chatPanel = getCopilotChatPanel(project)
            if (chatPanel != null) {
                modelPanel = ComponentFinder.findFirstByClassName(chatPanel, CopilotClassNames.MODEL_PICK_PANEL)
            }
        }

        if (modelPanel == null) {
            LOG.warn("selectModelByName: ModelPickPanel not found")
            return false
        }

        LOG.info("selectModelByName: Looking for model '$modelName'")

        // Get item count
        val itemCount = ReflectionUtil.getItemCount(modelPanel)
        if (itemCount <= 0) {
            LOG.warn("selectModelByName: No items in model panel")
            return false
        }

        // Build list of non-separator items with their names
        val items = mutableListOf<Triple<Int, Any, String>>()
        for (i in 0 until itemCount) {
            val item = ReflectionUtil.getItemAt(modelPanel, i) ?: continue

            // Skip separators
            try {
                val isSeparator = item.javaClass.getMethod("isSeparator").invoke(item) as? Boolean ?: false
                if (isSeparator) continue
            } catch (e: Exception) {
                // No isSeparator method, continue
            }

            val itemName = item.toString()
            items.add(Triple(i, item, itemName))
            LOG.debug("selectModelByName: Item $i = '$itemName'")
        }

        // First try exact match (case-insensitive)
        for ((index, item, itemName) in items) {
            if (itemName.equals(modelName, ignoreCase = true)) {
                LOG.info("selectModelByName: Exact match '$modelName' at index $index")
                return selectModelItem(modelPanel, item, index)
            }
        }

        // Then try partial match (contains)
        for ((index, item, itemName) in items) {
            if (itemName.contains(modelName, ignoreCase = true)) {
                LOG.info("selectModelByName: Partial match '$modelName' at index $index (name: '$itemName')")
                return selectModelItem(modelPanel, item, index)
            }
        }

        LOG.warn("selectModelByName: Model '$modelName' not found")
        return false
    }

    /**
     * Select a model item in the model picker.
     */
    private fun selectModelItem(modelPanel: Component, item: Any, index: Int): Boolean {
        // Try setSelectedItem first
        try {
            modelPanel.javaClass.getMethod("setSelectedItem", Any::class.java).invoke(modelPanel, item)
            LOG.info("selectModelItem: setSelectedItem succeeded")
            return true
        } catch (e: Exception) {
            LOG.debug("selectModelItem: setSelectedItem failed: ${e.message}")
        }

        // Try setSelectedIndex
        try {
            modelPanel.javaClass.getMethod("setSelectedIndex", Int::class.java).invoke(modelPanel, index)
            LOG.info("selectModelItem: setSelectedIndex succeeded")
            return true
        } catch (e: Exception) {
            LOG.debug("selectModelItem: setSelectedIndex failed: ${e.message}")
        }

        LOG.warn("selectModelItem: All approaches failed")
        return false
    }

    fun setModelClaudeSonnet4(project: Project): Boolean {
        return selectModelByName(project, "Claude Sonnet 4")
    }

    fun setModelGeminiPro(project: Project): Boolean {
        return selectModelByName(project, "Gemini 2.5 Pro")
    }

    fun setModelGPT4o(project: Project): Boolean {
        return selectModelByName(project, "GPT-4o")
    }

    fun setModelGPT41(project: Project): Boolean {
        return selectModelByName(project, "GPT-4.1")
    }

    // Legacy method - defaults to GPT-4o
    fun setModelGPT(project: Project): Boolean {
        return setModelGPT4o(project)
    }

    // =========================================================================
    // ComboBox Helpers
    // =========================================================================

    /**
     * Try to select a combo box item by matching the item's display name.
     */
    private fun selectComboBoxItemByName(comboBox: Component, itemName: String): Boolean {
        val itemCount = ReflectionUtil.getItemCount(comboBox)
        if (itemCount < 0) {
            LOG.debug("selectComboBoxItemByName: Could not get item count")
            return false
        }

        LOG.debug("selectComboBoxItemByName: Searching for '$itemName' in $itemCount items")

        for (i in 0 until itemCount) {
            val item = ReflectionUtil.getItemAt(comboBox, i) ?: continue
            val itemString = item.toString()

            LOG.debug("selectComboBoxItemByName: Item $i = '$itemString'")

            if (itemString.contains(itemName, ignoreCase = true)) {
                LOG.info("selectComboBoxItemByName: Found match at index $i")

                // Try setSelectedItem first (more reliable for some combo boxes)
                if (ReflectionUtil.setSelectedItem(comboBox, item)) {
                    LOG.info("selectComboBoxItemByName: setSelectedItem succeeded")
                    return true
                }

                // Fallback to setSelectedIndex
                if (ReflectionUtil.setSelectedIndex(comboBox, i)) {
                    LOG.info("selectComboBoxItemByName: setSelectedIndex succeeded")
                    return true
                }

                LOG.warn("selectComboBoxItemByName: Both selection methods failed")
                return false
            }
        }

        LOG.debug("selectComboBoxItemByName: No match found for '$itemName'")
        return false
    }

    /**
     * Select a combo box item by index.
     */
    private fun selectComboBoxByIndex(comboBox: Component, index: Int, componentName: String): Boolean {
        if (ReflectionUtil.setSelectedIndex(comboBox, index)) {
            LOG.debug("selectComboBoxByIndex: Set $componentName to index $index")
            return true
        }
        LOG.warn("selectComboBoxByIndex: Failed to set index $index on $componentName")
        return false
    }

    // =========================================================================
    // Context Toggle
    // =========================================================================

    /**
     * Toggle off the current file context.
     */
    fun toggleOffCurrentFileContext(project: Project): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.warn("toggleOffCurrentFileContext: Failed to activate tool window")
            return false
        }

        val chatPanel = getCopilotChatPanel(project)
        if (chatPanel == null) {
            LOG.warn("toggleOffCurrentFileContext: Chat panel not found")
            return false
        }

        val toggle = ComponentFinder.findFirstByClassName(chatPanel, CopilotClassNames.ON_OFF_BUTTON)
        if (toggle == null) {
            LOG.warn("toggleOffCurrentFileContext: OnOffButton not found")
            return false
        }

        return try {
            toggle.javaClass.getMethod("setSelected", Boolean::class.java).invoke(toggle, false)
            LOG.debug("toggleOffCurrentFileContext: Toggled off current file context")
            true
        } catch (e: Exception) {
            LOG.warn("toggleOffCurrentFileContext: Failed to toggle: ${e.message}")
            false
        }
    }

    // =========================================================================
    // Legacy Compatibility (for external callers)
    // =========================================================================

    /**
     * @deprecated Use ComponentFinder.findByClassName instead
     */
    fun findComponentsByClassName(
        comp: Component?,
        className: String,
        result: MutableList<Component>,
        stopOnFirst: Boolean = false
    ) {
        if (comp == null) return
        result.addAll(ComponentFinder.findByClassName(comp, className, stopOnFirst))
    }

    /**
     * @deprecated Use ComponentFinder.findFirstByClassName instead
     */
    fun findFirstComponentByClassName(comp: Component?, className: String): Component? {
        return ComponentFinder.findFirstByClassName(comp, className)
    }

    /**
     * @deprecated Use ReflectionUtil.invokeMethod instead
     */
    fun safeInvokeMethod(target: Any, methodName: String): Any? {
        return ReflectionUtil.invokeMethod(target, methodName)
    }
}
