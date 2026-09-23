# keylocate Employee Guide

Welcome to keylocate! This guide will help you understand and use the key management system effectively.

## Table of Contents
1. [What is keylocate?](#what-is-keylocate)
2. [Getting Started](#getting-started)
3. [User Roles and Permissions](#user-roles-and-permissions)
4. [Dashboard Overview](#dashboard-overview)
5. [Managing Keys](#managing-keys)
6. [Managing Locations](#managing-locations)
7. [Issuing and Returning Keys](#issuing-and-returning-keys)
8. [Moving Keys Between Locations](#moving-keys-between-locations)
9. [Conducting Audits](#conducting-audits)
10. [Viewing Key History](#viewing-key-history)
11. [Bulk Operations](#bulk-operations)
12. [System Settings](#system-settings)
13. [Common Tasks](#common-tasks)
14. [Troubleshooting](#troubleshooting)

---

## What is keylocate?

keylocate is a digital system for tracking physical keys across multiple locations. Instead of using paper logs or spreadsheets, keylocate provides:

- **Real-time tracking** of where every key bunch is located
- **Complete history** of who took keys and when
- **Audit trails** to verify all keys are accounted for
- **Status tracking** to know if keys are present, missing, or issued out
- **Mobile access** so you can manage keys from anywhere

---

## Getting Started

### Logging In
1. Open the keylocate app in your web browser
2. Click "Log in with Replit" to sign in
3. You'll be taken to the dashboard after successful login

### Navigation
The main menu is located on the left side (or top on mobile):
- **Dashboard** - Overview of all keys and statistics
- **Key Bunches** - Manage individual key sets
- **Locations** - Manage physical locations (offices, vans, etc.)
- **History** - View all key movements and changes
- **Settings** - Customize the system (admin only)
- **Profile** - Manage your account

---

## User Roles and Permissions

There are three user roles in keylocate:

### Officer (Basic User)
- View keys and locations
- Issue and return keys
- Move keys between locations
- Conduct audits
- View history

### Administrator
- All officer permissions
- Create, edit, and delete keys
- Create and manage locations
- Upload keys in bulk
- Customize system settings (key types, statuses, etc.)

### Super Administrator
- All administrator permissions
- Manage user accounts
- Access all company data
- Configure advanced settings

---

## Dashboard Overview

The dashboard shows you key information at a glance:

### Key Statistics
- **Total Keys** - Number of key bunches in the system
- **Present** - Keys currently at their assigned location
- **Missing** - Keys that haven't been accounted for
- **Issued** - Keys signed out to staff or customers

### Status Breakdown
A visual chart showing the distribution of keys across different statuses.

### Recent Activity
The latest 10 key movements and changes, showing:
- What happened (issued, returned, moved, etc.)
- Which key bunch
- Who performed the action
- When it occurred

---

## Managing Keys

### Viewing Keys
1. Click **"Key Bunches"** in the menu
2. Use filters to find specific keys:
   - **Search** by identifier or tag
   - **Filter by Type** (Day Shift, Night Shift, etc.)
   - **Filter by Status** (Present, Missing, Issued, Inactive)
   - **Filter by Location**

### Adding a New Key Bunch
1. Go to **Key Bunches** page
2. Click **"Add Key Bunch"** button
3. Fill in the required information:
   - **Identifier** - Unique code (e.g., "A24-001")
   - **Type** - Category of keys (Day Shift, Lock Ups, etc.)
   - **Current Tag** - Physical tag attached to keys
   - **Location** - Where the keys are kept
   - **Status** - Current status (usually "Present")
   - **Key Count** - Number of physical keys
   - **Fob Count** - Number of key fobs
   - **Description** - What the keys are for
   - **Address** - Property address (if applicable)
   - **Notes** - Any additional information
4. Click **"Create Key Bunch"**

### Editing a Key Bunch
1. Find the key in the Key Bunches list
2. Click the **pencil icon** (Edit)
3. Update the information
4. Click **"Update Key Bunch"**

### Using NFC Tags
Some keys have NFC tags for quick scanning:
1. When adding/editing a key, click **"Scan NFC"**
2. Hold your phone near the NFC tag
3. The NFC serial number will be automatically entered
4. If a tag is already in use, you'll see which key has it

**Note:** Each NFC tag can only be assigned to one key bunch at a time.

### Deleting a Key Bunch
1. Find the key in the Key Bunches list
2. Click the **trash icon** (Delete)
3. Enter a reason for deletion
4. Confirm the deletion

**Important:** Deleted keys can be viewed by toggling "Show Deleted Keys" on the Key Bunches page, and their full history is preserved.

---

## Managing Locations

### Viewing Locations
1. Click **"Locations"** in the menu
2. You'll see all locations with:
   - Location name
   - Type (Office, Van, etc.)
   - Number of keys at that location

### Adding a New Location
1. Go to **Locations** page
2. Click **"Add Location"** button
3. Enter:
   - **Name** - Location identifier (e.g., "Van 5", "Head Office")
   - **Type** - Category of location
4. Click **"Add Location"**

### Viewing Keys at a Location
1. Click on a location card
2. You'll see all keys currently at that location
3. You can:
   - Issue keys from this location
   - Move multiple keys at once
   - View key details

---

## Issuing and Returning Keys

### Issuing Keys (Signing Out)
1. Find the key bunch you want to issue
2. Click **"Issue"** button
3. Fill in the form:
   - **Issued To** - Person or company receiving the keys
   - **Contact** - Phone number or email
   - **Notes** - Purpose or additional details
4. Click **"Issue Key"**

The key status will change to "Issued" and it will no longer count as present at the location.

### Returning Keys (Signing In)
1. Find the issued key bunch
2. Click **"Return"** button
3. Select the location where it's being returned
4. Add any notes (optional)
5. Click **"Return Key"**

The key status will change back to "Present" at the selected location.

---

## Moving Keys Between Locations

### Moving a Single Key
1. Find the key bunch
2. Click **"Move"** button
3. Select the destination location
4. Add notes (optional)
5. Click **"Move Key"**

### Moving Multiple Keys (Bulk Move)
1. Go to **Key Bunches** page
2. Click **"Bulk Move Keys"** button
3. Select:
   - **Source Location** - Where keys currently are
   - **Destination Location** - Where they're going
   - **Key Type** - Which type of keys to move
4. Review the list of keys that will be moved
5. Click **"Move Keys"**

**Important:** Bulk moves require a recent audit of the source location to ensure accuracy.

---

## Conducting Audits

Audits help verify that all keys are accounted for at a location.

### Starting an Audit
1. Go to **Locations** page
2. Click on the location to audit
3. Click **"Start Audit"**
4. You'll see a list of keys expected to be present

### Scanning Keys
For each key at the location:
1. Find it in the audit list
2. Click **"Mark as Scanned"** or scan the NFC tag
3. The key will be marked with a green checkmark

### Handling Missing Keys
If a key is not physically present:
1. Leave it unscanned
2. When you complete the audit, it will automatically be marked as "Missing"

### Completing an Audit
1. After scanning all present keys, click **"Complete Audit"**
2. Review the summary:
   - Expected keys
   - Scanned keys
   - Missing keys
3. Confirm to finish the audit

**Result:** Missing keys will have their status updated automatically, creating a clear audit trail.

---

## Viewing Key History

### Individual Key History
1. Go to **Key Bunches** page
2. Click on a key bunch to open details
3. Click the **"History"** tab
4. You'll see:
   - All movements (issued, returned, moved)
   - Status changes
   - Field edits
   - Who performed each action
   - When it occurred

### Key History Features
- **Photo Upload** - Add photos of keys or related items
- **Document Upload** - Attach PDFs (max 10MB)
- **Timeline View** - Chronological list of all events
- **Filtering** - Search by action type or date

### System-Wide History
1. Click **"History"** in the main menu
2. View all key movements across the entire system
3. Filter by:
   - Key bunch
   - Location
   - User who performed the action
   - Date range
   - Action type

---

## Bulk Operations

### Bulk Upload from CSV
Upload multiple keys at once from a spreadsheet:

1. Prepare your CSV file with these columns:
   - identifier (required)
   - type (required)
   - currentTag
   - nfcSerial
   - location
   - status
   - keyCount
   - fobCount
   - keyDescription
   - address
   - notes

2. Go to **Key Bunches** page
3. Click **"Bulk Upload"** button
4. Click **"Upload CSV"** and select your file
5. Review the validation results:
   - Green rows are valid
   - Red rows have errors
6. Fix any errors and re-upload if needed
7. Click **"Upload Keys"** to create all valid entries

**Tips:**
- Download the sample CSV template first
- Ensure location names exactly match existing locations
- Empty rows are automatically skipped
- Each NFC tag must be unique

---

## System Settings

*Admin access required*

### Customizing Key Types
1. Go to **Settings** page
2. Click **"Key Types"** tab
3. You can:
   - Add new key types
   - Edit names and colors
   - Activate/deactivate types
   - Reorder the list

### Customizing Location Types
1. Go to **Settings** > **Location Types**
2. Similar to key types:
   - Add, edit, or remove types
   - Customize display names and colors

### Status Configuration
The system has 4 core statuses that cannot be deleted:
- **Present** - Keys at their assigned location
- **Missing** - Keys unaccounted for
- **Issued** - Keys signed out
- **Inactive** - Keys not in active use

You can edit their names and colors, but not add or remove statuses.

### User Management
1. Go to **Settings** > **Users**
2. View all users in your company
3. For each user you can:
   - Change their role (Officer, Admin, Super Admin)
   - Grant custom permissions
   - View their activity

---

## Common Tasks

### Daily Key Sign-Out
**Scenario:** An engineer needs keys for a property visit

1. Go to **Key Bunches**
2. Find the keys by searching or filtering
3. Click **"Issue"**
4. Enter engineer's name and contact info
5. Add notes about which property
6. Submit

### Daily Key Sign-In
**Scenario:** Engineer returns keys at end of day

1. Find the issued key bunch
2. Click **"Return"**
3. Select the location (e.g., "Head Office")
4. Submit

### Weekly Van Audit
**Scenario:** Verify all keys in Van 5

1. Go to **Locations**
2. Click on "Van 5"
3. Click **"Start Audit"**
4. Physically check each key and mark as scanned
5. Complete the audit
6. Review any missing keys

### Transfer Keys Between Offices
**Scenario:** Move all Day Shift keys from Office A to Office B

1. Click **"Bulk Move Keys"**
2. Source: Office A
3. Destination: Office B
4. Type: Day Shift
5. Review the list
6. Confirm the move

### Find Missing Keys
**Scenario:** A key was marked missing during audit

1. Go to **Key Bunches**
2. Filter by Status: "Missing"
3. Review the list
4. Check **History** to see when and where it went missing
5. Once found, edit the key to change status back to "Present"

---

## Troubleshooting

### "Key not found when I search"
- Check your filters - you might have a type or location filter active
- Verify spelling of the identifier
- Check if "Show Deleted Keys" toggle is off

### "Can't issue a key"
- Ensure the key status is "Present"
- Verify you have the required permissions
- Check that the key is at a location (not unassigned)

### "Bulk move shows 0 keys available"
- Ensure source location is correct
- Check if those keys were recently audited
- Verify the key type filter matches the keys you want to move

### "NFC tag already in use"
- Each NFC tag can only be on one key bunch
- Check which key has that tag (shown in error message)
- Either remove the tag from the other key or use a different tag

### "Can't complete audit"
- You must scan at least one key
- Check your internet connection
- Try refreshing the page

### "Missing permissions to perform action"
- Contact your administrator
- They can grant you specific permissions or change your role

---

## Best Practices

1. **Always log movements** - Issue and return keys properly, don't just take them
2. **Keep descriptions clear** - Use consistent naming for properties/purposes
3. **Update tags** - If physical tags change, update them in the system
4. **Regular audits** - Weekly or monthly audits catch problems early
5. **Review history** - When keys go missing, check the history to trace them
6. **Use notes fields** - Add context that helps others understand what happened
7. **Upload photos** - Pictures of unique keys or properties help identification
8. **Clean up inactive keys** - Mark old keys as Inactive rather than deleting

---

## Quick Reference Card

### Most Common Daily Tasks

| Task | Quick Steps |
|------|-------------|
| **Issue Keys** | Key Bunches → Find key → Issue button → Fill form → Submit |
| **Return Keys** | Key Bunches → Find key → Return button → Select location → Submit |
| **Move Keys** | Key Bunches → Find key → Move button → Select destination → Submit |
| **Start Audit** | Locations → Select location → Start Audit → Scan keys → Complete |
| **Add New Key** | Key Bunches → Add Key Bunch → Fill all fields → Create |
| **Find Key History** | Key Bunches → Click key → History tab |
| **Check Missing Keys** | Key Bunches → Filter: Status = Missing |

### Keyboard Shortcuts & Tips

- **Ctrl/Cmd + F** - Use browser search to find key identifiers quickly
- **Tab** - Navigate through form fields
- **Enter** - Submit forms (when in input fields)
- **Esc** - Close dialog boxes

### Key Status Quick Reference

| Status | Meaning | Common Actions |
|--------|---------|----------------|
| **Present** | At assigned location | Issue, Move, Audit |
| **Missing** | Unaccounted for | Search history, Update when found |
| **Issued** | Signed out to someone | Return when brought back |
| **Inactive** | Not in active use | Reactivate or keep for records |

### Emergency Contacts

- **System Issues:** Contact your administrator
- **Missing Keys:** Check History, notify supervisor
- **Account Problems:** Contact super administrator

---

## Administrator Guide

### Admin Responsibilities

As an administrator, you're responsible for:
- Maintaining accurate key and location data
- Managing system settings and configurations
- Training new users
- Generating reports and insights
- Ensuring data integrity

### Setting Up the System

#### Initial Configuration
1. **Customize Key Types**
   - Go to Settings → Key Types
   - Add your organization's key categories
   - Assign colors for visual identification
   - Set appropriate display names

2. **Configure Location Types**
   - Settings → Location Types
   - Add vehicle types (Van, Truck, etc.)
   - Add facility types (Office, Warehouse, etc.)
   - Choose distinct colors

3. **Set Up Initial Locations**
   - Create all physical locations
   - Use consistent naming (Van 1, Van 2, Office A, etc.)
   - Assign correct types

4. **Import Existing Keys**
   - Prepare CSV with current inventory
   - Use bulk upload feature
   - Verify all imports successful
   - Audit each location to confirm

#### User Management

**Adding New Users:**
1. Settings → Users
2. Invite new user (they'll receive email)
3. Assign appropriate role:
   - Officer for field staff
   - Administrator for managers
   - Super Administrator for IT/senior management
4. Set custom permissions if needed

**Managing Permissions:**
- **View Permissions:** User can see data
- **Edit Permissions:** User can modify data
- **Create Permissions:** User can add new records
- **Delete Permissions:** User can remove records
- **Admin Access:** Full system configuration access

**Custom Permission Overrides:**
You can grant specific permissions outside the standard roles:
- Allow an Officer to manage locations
- Give an Officer bulk upload access
- Restrict an Admin from deleting keys

### Data Maintenance

#### Weekly Tasks
- Review missing keys report
- Check audit compliance (all locations audited)
- Verify no duplicate identifiers
- Clean up issued keys over 30 days old

#### Monthly Tasks
- Archive inactive keys
- Review user permissions
- Check for unused locations
- Update key descriptions as needed
- Export data backup

#### Quarterly Tasks
- Comprehensive system audit
- Review and optimize key types
- Update employee training materials
- Assess system usage patterns

### Handling Data Issues

**Duplicate Identifiers:**
1. Search for the duplicate identifier
2. Determine which is correct
3. Rename or delete the incorrect entry
4. Add note explaining the change

**Missing Audit Trail:**
If history seems incomplete:
1. Check the full history page (not just recent)
2. Verify user had proper permissions
3. Contact support if data is truly missing

**Bulk Corrections:**
For systemic issues:
1. Export affected keys to CSV
2. Make corrections in spreadsheet
3. Delete incorrect entries
4. Re-import via bulk upload

### Generating Reports

While keylocate has built-in views, you can create custom reports:

**Monthly Key Activity Report:**
1. History page → Set date range to last month
2. Export data (browser print to PDF)
3. Review patterns: most issued keys, busiest locations
4. Share with management

**Audit Compliance Report:**
1. Check last audit date for each location
2. Identify overdue audits (>1 week)
3. Assign audit responsibilities
4. Follow up on completion

**Missing Keys Investigation:**
1. Filter keys by Missing status
2. Review history for each
3. Document last known location and user
4. Create action plan for recovery

### Training New Employees

**Week 1 - Basics:**
- System login and navigation
- Viewing keys and locations
- Basic search and filters
- Understanding status indicators

**Week 2 - Core Functions:**
- Issue and return procedures
- Moving keys between locations
- Adding notes and context
- Viewing history

**Week 3 - Advanced Features:**
- Conducting audits
- Using NFC scanning (if available)
- Bulk operations
- Troubleshooting common issues

**Assessment:**
- Shadow experienced user for 2-3 days
- Perform practice audit
- Complete test scenarios
- Quiz on system procedures

---

## Frequently Asked Questions (FAQ)

### General Questions

**Q: Can I access keylocate from my phone?**  
A: Yes! keylocate is fully mobile-responsive. Use your phone's browser to access the system.

**Q: Do I need to install any apps?**  
A: No. keylocate runs entirely in your web browser. Just bookmark the URL for quick access.

**Q: What browsers are supported?**  
A: Modern browsers including Chrome, Firefox, Safari, and Edge. For best results, keep your browser updated.

**Q: Can multiple people use the system at the same time?**  
A: Absolutely! keylocate is designed for multi-user access. Changes sync in real-time.

**Q: Is my data secure?**  
A: Yes. All data is encrypted, backed up regularly, and separated by company. Users can only see their own company's data.

### Key Management Questions

**Q: Can the same identifier exist at multiple locations?**  
A: Yes! The system allows identical identifiers at different locations. This is useful for property-specific keys.

**Q: What happens if I delete a key by mistake?**  
A: Deleted keys can be viewed using the "Show Deleted Keys" toggle. All history is preserved. Contact an admin to restore if needed.

**Q: Can I have keys without NFC tags?**  
A: Yes. NFC is optional. Leave the NFC field blank for keys without tags.

**Q: How do I handle keys that are in transit?**  
A: Issue the key with notes indicating it's being transferred. Once it arrives, return it to the new location.

**Q: What if a key gets a new physical tag?**  
A: Edit the key and update the "Current Tag" field. The history will show this change.

### Audit Questions

**Q: How often should we audit locations?**  
A: Weekly is recommended for high-traffic locations. Monthly for low-traffic. Adjust based on your needs.

**Q: What if I can't find a key during an audit?**  
A: Leave it unscanned. When you complete the audit, it will automatically be marked as missing.

**Q: Can I pause an audit and continue later?**  
A: Yes. Audits stay open until you complete them. You can scan keys over multiple sessions.

**Q: Do I need to scan keys in any particular order?**  
A: No. Scan in whatever order is convenient. The system tracks everything automatically.

**Q: What if we find extra keys that aren't in the system?**  
A: Add them immediately using the "Add Key Bunch" feature, then include them in the audit.

### Permissions Questions

**Q: Why can't I delete keys?**  
A: Delete permission is restricted to administrators. This prevents accidental data loss. Contact your admin if you need something deleted.

**Q: Can I issue keys if I'm an Officer?**  
A: Yes! Officers have permission to issue and return keys.

**Q: How do I request additional permissions?**  
A: Ask your administrator. They can grant custom permissions for specific tasks.

### Technical Questions

**Q: The page won't load. What should I do?**  
A: Try refreshing the page. If that doesn't work, clear your browser cache and cookies, then try again.

**Q: My changes aren't saving. Why?**  
A: Check your internet connection. The system requires connectivity to save data.

**Q: Can I work offline?**  
A: No. keylocate requires an internet connection to function and keep data synchronized.

**Q: How do I print a location's key list?**  
A: Go to the location page and use your browser's print function (Ctrl/Cmd + P).

---

## New Employee Onboarding Checklist

Use this checklist to ensure new employees are properly trained:

### Pre-Day One
- [ ] Create user account in system
- [ ] Assign appropriate role (Officer/Admin)
- [ ] Send login credentials
- [ ] Provide link to this guide

### Day One
- [ ] Login verification
- [ ] Tour of main navigation
- [ ] Dashboard overview
- [ ] Find a key using search
- [ ] View a key's history
- [ ] View a location's keys

### Week One
- [ ] Issue a key (supervised)
- [ ] Return a key (supervised)
- [ ] Move a key between locations
- [ ] Add notes to a key operation
- [ ] View system-wide history
- [ ] Understand status indicators

### Week Two
- [ ] Conduct a full location audit (supervised)
- [ ] Use NFC scanning (if applicable)
- [ ] Handle a missing key scenario
- [ ] Add a new key bunch (Admin only)
- [ ] Perform bulk move operation (Admin only)

### Week Three
- [ ] Independent audit completion
- [ ] Troubleshoot a common issue
- [ ] Know when to escalate to admin
- [ ] Understand best practices
- [ ] Complete competency assessment

### Week Four
- [ ] Fully independent operations
- [ ] Train another new user (optional)
- [ ] Provide feedback on system usage

### Ongoing
- [ ] Monthly review of procedures
- [ ] Stay updated on system changes
- [ ] Share improvement suggestions

**Trainer Signature:** _________________ **Date:** _______  
**Employee Signature:** _________________ **Date:** _______

---

## Video Tutorial Scripts

These scripts can be used to create video walkthroughs:

### Video 1: Getting Started (5 minutes)

**[00:00 - Opening]**  
"Welcome to keylocate! In this quick tutorial, we'll show you how to get started with the key management system."

**[00:15 - Login]**  
"First, open your web browser and navigate to the keylocate URL. Click 'Log in with Replit' and enter your credentials."

**[00:30 - Dashboard Tour]**  
"After logging in, you'll see the dashboard. Here you can see total keys, how many are present, missing, or issued out. The recent activity shows the latest key movements."

**[01:00 - Navigation]**  
"On the left side, you'll find the main menu. Key Bunches shows all your keys. Locations shows where keys are stored. History shows all movements. Settings is for administrators only."

**[01:30 - Finding a Key]**  
"Let's find a specific key. Click 'Key Bunches'. You can use the search box to find by identifier, or use the filters to narrow down by type, status, or location."

**[02:00 - Viewing Details]**  
"Click on any key to see its details: identifier, current tag, location, status, number of keys and fobs, and description."

**[02:30 - History Tab]**  
"Click the History tab to see every movement of this key - when it was issued, to whom, when it was returned, everything."

**[03:00 - Closing]**  
"That's the basics! In our next video, we'll show you how to issue and return keys. See you then!"

### Video 2: Issuing and Returning Keys (7 minutes)

**[00:00 - Opening]**  
"In this tutorial, we'll learn how to issue keys to customers or staff, and how to return them when they come back."

**[00:15 - Issue Scenario]**  
"Let's say an engineer needs keys for a property visit. First, find the key bunch they need using the search or filters."

**[00:45 - Issue Process]**  
"Click the 'Issue' button. A form appears. Enter who you're issuing to - like 'John Smith' or 'ABC Contractors'. Add their contact info, and notes about why they need the keys."

**[01:30 - Submit]**  
"Click 'Issue Key'. The status instantly changes to 'Issued' and you'll see it's no longer at the location. Check the history - there's a new entry showing you issued it, with all the details you entered."

**[02:00 - Finding Issued Keys]**  
"To see all issued keys, use the status filter and select 'Issued'. This shows everyone who currently has keys out."

**[02:30 - Return Scenario]**  
"Now the engineer returns. Find the key in the issued list and click 'Return'."

**[03:00 - Return Process]**  
"Select which location they're returning it to - usually where it came from. Add any notes if needed, like 'Returned end of day'."

**[03:30 - Submit Return]**  
"Click 'Return Key'. The status changes back to 'Present' and it's back at the location. Everything is logged in the history."

**[04:00 - Best Practices]**  
"Always enter contact information when issuing keys. Use the notes field to add property addresses or purpose. This makes it easy to track down keys if needed."

**[04:30 - Closing]**  
"That's how you issue and return keys! Next, we'll cover conducting audits."

### Video 3: Conducting Audits (10 minutes)

**[00:00 - Opening]**  
"Audits are how we verify all keys are accounted for. In this video, you'll learn the complete audit process."

**[00:20 - Why Audit]**  
"Regular audits catch missing keys early, ensure data accuracy, and maintain accountability. We recommend weekly audits for high-use locations."

**[00:45 - Starting an Audit]**  
"Go to Locations and select the location you want to audit - let's do Van 5. Click 'Start Audit'."

**[01:15 - Audit Screen]**  
"You'll see a list of all keys that should be present at this location. Each one needs to be physically verified."

**[01:45 - Scanning Keys]**  
"Take each physical key and find it in the list. You can search by identifier or tag number. Click 'Mark as Scanned' for each key you physically have."

**[02:30 - NFC Scanning (if applicable)]**  
"If your keys have NFC tags, tap your phone on the tag. It will automatically be marked as scanned. This is much faster than manual entry."

**[03:15 - Missing Keys]**  
"If a key is supposed to be there but you can't find it, just leave it unscanned. Don't worry, we'll handle it when we complete the audit."

**[04:00 - Extra Keys]**  
"If you find a key that's not on the list, it might be in the system at a different location. Check its tag or identifier. If it's not in the system at all, add it as a new key first."

**[04:45 - Completing the Audit]**  
"Once you've scanned everything you can find, click 'Complete Audit'. Review the summary: it shows expected keys, scanned keys, and which ones are missing."

**[05:30 - Confirm Completion]**  
"Confirm the audit. The system will automatically mark unscanned keys as 'Missing'. This creates a clear record for investigation."

**[06:00 - After the Audit]**  
"Check the history page - you'll see the audit event logged. Any keys marked missing will appear in the missing filter. You can investigate their last known location in their individual history."

**[06:45 - Bulk Operations Note]**  
"Important: Some bulk operations require recent audits. This ensures you're moving the keys you think you're moving. So keep audits up to date!"

**[07:30 - Best Practices]**  
"Do audits at the same time each week. Have the physical location organized to make scanning easier. If you find patterns of missing keys, investigate immediately."

**[08:00 - Closing]**  
"That's the audit process! Practice a few times and it becomes quick and routine. Next video covers bulk operations and CSV uploads."

---

## Getting Help

### In-App AI Assistant

keylocate has a built-in AI assistant that can answer questions about how to use the system:

1. Click **"Help"** in the main menu
2. Type your question in the chat box
3. Get instant answers about features, procedures, and troubleshooting
4. The AI has been trained on this entire guide

**Example questions you can ask:**
- "How do I issue a key?"
- "What should I do if a key is missing during an audit?"
- "How do I add a new location?"
- "What permissions do administrators have?"

### Traditional Support

If you encounter issues not covered in this guide or the AI assistant:

1. Check the **History** page for system events
2. Ask your administrator or super administrator
3. Review recent changes in Settings (if you have access)
4. Check if other users are experiencing the same issue

Remember: Every action in keylocate is logged, so if something goes wrong, there's always a trail to follow to understand what happened.

### Feedback and Suggestions

Have ideas to improve keylocate? Contact your administrator with:
- Feature requests
- User interface improvements
- Workflow optimizations
- Training material updates

---

**Document Version:** 2.0  
**Last Updated:** Expanded with Quick Reference, Admin Guide, FAQ, Onboarding, and Video Scripts  
**System:** keylocate Key Management System  
**Location:** This guide is available in the Help section of the application
