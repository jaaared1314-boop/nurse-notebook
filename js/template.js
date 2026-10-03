/* Charge Nurse Checklist — shift template.
 *
 * This file is the single source of truth for what appears on the checklist.
 * To add/remove/reword a task, edit it here. Nothing else needs to change.
 *
 * Node shape:
 *   id        unique within its parent (used to build the storage key)
 *   label     what you see
 *   note      short reminder shown under the label, always visible
 *   help      longer guidance, hidden behind the (i) button
 *   field     an input attached to the task:
 *               {type:'room'}      room dropdown, populated from Settings
 *               {type:'text', placeholder}
 *               {type:'times'}     a list of timestamps you add with one tap
 *               {type:'textlist', placeholder, addLabel}
 *                                  several free-text lines, added one at a time
 *               {type:'longtext'}   multi-line box for the shift report
 *   children  nested subtasks
 *   repeat    makes the task a "+ Add" list: one entry per room/item
 *               {addLabel, field, children}
 *   bare      the task exists only to host its repeat list — render the
 *             "+ Add" button without a checkbox row of its own
 *   when      only applies on certain days
 *               {dow:2}       day of week (0=Sun … 2=Tue)
 *               {dow:2, firstOfMonth:true}
 *   at        time-of-day cue, "HH:MM" — highlights when that time is near/past
 *   flag      hidden unless the matching Settings toggle is on
 */

const TEMPLATE = [
  {
    id: 'todo',
    title: 'To Do',
    kind: 'todo',
    blurb: 'Anything that comes up mid-shift. Add it here so it is not living in your head.',
  },

  {
    id: 'atd',
    title: 'Admit / Transfer / Discharge',
    items: [
      {
        id: 'patient',
        label: 'Patient',
        bare: true,
        repeat: {
          addLabel: 'Add rooms',
          field: { type: 'room' },
          children: [
            { id: 'sticker', label: 'Stickered in log book' },
            {
              id: 'hospice',
              label: 'Hospice — extra sticker placed first',
              note: 'If hospice, add one sticker first when flipping the chart.',
            },
          ],
        },
      },
    ],
  },

  {
    id: 'restraints',
    title: 'Restraints',
    blurb: 'Q2 charting is time-based — the app shows you when each patient is next due.',
    items: [
      {
        id: 'patient',
        label: 'Patient',
        bare: true,
        repeat: {
          addLabel: 'Add rooms',
          field: { type: 'room' },
          q2: true,
          children: [
            {
              id: 'order',
              label: 'Order confirmed',
              help: 'Confirm the order type and that it is current. Violent/self-destructive orders renew far more often than non-violent ones — check the order date and time, not just that an order exists.',
            },
            { id: 'sticker', label: 'Stickered in log book' },
            {
              id: 'q2',
              label: 'Q2 charting done',
              field: { type: 'times' },
              help: 'Tap "Log time" each time Q2 charting is completed for this patient. The app shows the next due time based on the last entry.',
            },
            { id: 'careplan', label: 'Care plan' },
          ],
        },
      },
    ],
  },

  {
    id: 'forms',
    title: 'Forms & Logs',
    items: [
      {
        id: 'narc',
        label: 'Narc count',
        note: 'Tuesdays',
        when: { dow: 2 },
      },
      {
        id: 'ioaudit',
        label: 'I&O audit',
        note: 'First Tuesday of the month',
        when: { dow: 2, firstOfMonth: true },
      },
      {
        id: 'cleng',
        label: 'Clinical Engineering / Maintenance requests',
        repeat: {
          addLabel: 'Add item',
          field: { type: 'text', placeholder: 'Item / equipment' },
          children: [
            { id: 'submitted', label: 'Request submitted' },
            { id: 'tagged', label: 'Item tagged and pulled from use' },
          ],
        },
      },
      {
        id: 'pulllog',
        label: 'Written pull log matches the online pull log',
        note: 'Downgrade, low-census (LC), and on-call.',
        help: 'If someone is on incentive AND on-call / low-census / pulled, they are not counted on the pull list.',
      },
      {
        id: 'impact',
        label: 'IMPACT / MIDAS reports',
        note: 'File them, or delegate to management.',
        repeat: {
          addLabel: 'Add situation',
          field: { type: 'text', placeholder: 'Situation' },
          children: [
            {
              id: 'detail',
              label: 'Details',
              field: { type: 'textlist', placeholder: 'What happened', addLabel: 'Add detail' },
            },
            { id: 'filed', label: 'Report filed' },
            { id: 'delegated', label: 'Delegated to management' },
          ],
        },
      },
      {
        id: 'nosecretary',
        label: 'No secretary on the floor — covering their work',
        flag: 'noSecretary',
        children: [
          { id: 'charts', label: 'Charts made for admissions / transfers' },
          { id: 'stickers', label: 'Stickers placed in logs' },
          { id: 'consults', label: 'Consults called' },
          { id: 'labs', label: 'Labs and armbands printed' },
        ],
      },
    ],
  },

  {
    id: 'equipment',
    title: 'Equipment & Supplies',
    items: [
      {
        id: 'cart1',
        label: 'Code Cart 1',
        children: [
          { id: 'locks', label: 'Locks / drawers checked', note: 'Do any need to be filled or re-locked?' },
          { id: 'zoll', label: 'Zoll check' },
          { id: 'pads', label: 'Extra pads' },
          { id: 'board', label: 'Backboard' },
        ],
      },
      {
        id: 'cart2',
        label: 'Code Cart 2',
        children: [
          { id: 'locks', label: 'Locks / drawers checked', note: 'Do any need to be filled or re-locked?' },
          { id: 'zoll', label: 'Zoll check' },
          { id: 'pads', label: 'Extra pads' },
          { id: 'board', label: 'Backboard' },
        ],
      },
      {
        id: 'cart3',
        label: 'Code Cart 3',
        children: [
          { id: 'locks', label: 'Locks / drawers checked', note: 'Do any need to be filled or re-locked?' },
          { id: 'zoll', label: 'Zoll check' },
          { id: 'pads', label: 'Extra pads' },
          { id: 'board', label: 'Backboard' },
        ],
      },
      {
        id: 'templog',
        label: 'Temp log',
        children: [
          { id: 'fridge', label: 'Fridge', field: { type: 'text', placeholder: 'Temp' } },
          { id: 'blanket', label: 'Blanket warmer', field: { type: 'text', placeholder: 'Temp' } },
          { id: 'wipes', label: 'Wipes warmer', field: { type: 'text', placeholder: 'Temp' } },
        ],
      },
      { id: 'cerebell', label: 'Cerebell on the unit and docked' },
      {
        id: 'crrt',
        label: 'Charge for new day of CRRT',
        note: 'At 0700.',
        at: '07:00',
        repeat: {
          addLabel: 'Add rooms',
          field: { type: 'room' },
          children: [{ id: 'charged', label: 'New day charged' }],
        },
      },
      {
        id: 'crrtsupply',
        label: 'Enough CRRT supplies for the next few shifts',
        help: 'If you are short, order now rather than at 0600 — this is the single most common thing dayshift inherits as a problem.',
      },
      { id: 'iphones', label: 'iPhones charging' },
      { id: 'glulock1', label: 'GluLock 1' },
      { id: 'glulock2', label: 'GluLock 2' },
      {
        id: 'pluggedin',
        label: 'Everything plugged in',
        children: [
          { id: 'ekg', label: 'EKG machines' },
          { id: 'wows', label: 'WOWs' },
          { id: 'us', label: 'Ultrasound' },
          { id: 'ipad', label: 'Interpreter iPad' },
        ],
      },
      { id: 'strokecart', label: 'Stroke cart plugged in and operational' },
    ],
  },

  {
    id: 'handoff',
    title: 'Handoff & Staffing',
    items: [
      { id: 'primary', label: 'Primary nurse contact identified', field: { type: 'text', placeholder: 'Name / ext' } },
      {
        id: 'orboard',
        label: 'OR board checked for the next day',
        help: 'Determines the bed holds dayshift needs for OR patients — hearts, TCARs, fem/pops. Flag these to the oncoming charge even if the hold is not placed yet.',
      },
      { id: 'rounding', label: 'Rounding sheet updated', note: 'Keep it current through the shift, not at the end.' },
      {
        id: 'teletracker',
        label: 'Nurse assignment entered into Tele Tracker',
        help: 'Clinical Operations → Patient Tracking Portal → Staff Assignment.',
      },
      {
        id: 'scan',
        label: 'Assignment / checklist scanned at end of shift',
        note: 'To Tory / Christina.',
        children: [{ id: 'copies', label: 'Copies made of the assignment sheets' }],
      },
      {
        id: 'rrt',
        label: 'RRT handoff to dayshift charge',
        note: 'Heads-up on patients who may go south.',
        repeat: {
          addLabel: 'Add rooms',
          field: { type: 'room' },
          children: [
            {
              id: 'situation',
              label: 'Situation',
              field: { type: 'textlist', placeholder: 'What happened / what to watch', addLabel: 'Add situation' },
            },
            { id: 'given', label: 'Handed off to oncoming charge' },
          ],
        },
      },
    ],
  },

  {
    id: 'report',
    title: 'Shift Report',
    blurb: 'This is what gets read out at the end of the shift. Anything typed here lands in the exported report.',
    items: [
      {
        id: 'unitissues',
        label: 'Unit issues',
        note: 'Employees, staffing, patients, families, house-wide.',
        field: { type: 'longtext' },
      },
      { id: 'falls', label: 'Falls / safety concerns', field: { type: 'longtext' } },
      { id: 'equipissues', label: 'Equipment issues', field: { type: 'longtext' } },
      {
        id: 'supplyissues',
        label: 'Supply issues',
        note: 'Include supplies taken from other units — list which unit.',
        field: { type: 'longtext' },
      },
    ],
  },

  {
    id: 'noaide',
    title: 'No Aide on the Floor',
    flag: 'noAide',
    blurb: 'Turn this section on in Settings when you are working short an aide.',
    items: [
      {
        id: 'chemsticks',
        label: 'Chem sticks',
        repeat: {
          addLabel: 'Add rooms',
          field: { type: 'room' },
          children: [
            { id: 'times', label: 'Checks', field: { type: 'times' } },
          ],
        },
      },
      {
        id: 'baths',
        label: 'Baths',
        repeat: {
          addLabel: 'Add rooms',
          field: { type: 'room' },
          children: [{ id: 'done', label: 'Bath done' }],
        },
      },
      {
        id: 'restock',
        label: 'Restock',
        children: [
          { id: 'linen', label: 'Linen stock' },
          { id: 'medroom', label: 'Med room' },
          { id: 'linecart', label: 'Line cart' },
          { id: 'labtray', label: 'Lab tray' },
          { id: 'ivtray', label: 'IV tray' },
        ],
      },
    ],
  },
];
