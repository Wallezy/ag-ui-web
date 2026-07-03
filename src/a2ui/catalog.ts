export type CatalogComponent = {
  name: string;
  category: string;
  description: string;
};

export const ASSISTANT_CATALOG_ID = 'https://rongka.local/catalogs/assistant/v1/catalog.json';

export const assistantCatalog: CatalogComponent[] = [
  { category: 'Layout', name: 'Card', description: 'Framed result container' },
  { category: 'Layout', name: 'Section', description: 'Unframed content band inside a surface' },
  { category: 'Layout', name: 'Row', description: 'Responsive horizontal layout' },
  { category: 'Layout', name: 'Col', description: 'Responsive column' },
  { category: 'Layout', name: 'Space', description: 'Compact spacing group' },
  { category: 'Layout', name: 'Divider', description: 'Divider line' },
  { category: 'Layout', name: 'Tabs', description: 'Tabbed content' },
  { category: 'Layout', name: 'Collapse', description: 'Expandable content' },
  { category: 'Text', name: 'Title', description: 'Section title' },
  { category: 'Text', name: 'Text', description: 'Inline text' },
  { category: 'Text', name: 'Paragraph', description: 'Paragraph text' },
  { category: 'Text', name: 'Tag', description: 'Status tag' },
  { category: 'Text', name: 'Badge', description: 'Badge' },
  { category: 'Text', name: 'Alert', description: 'Notice or risk message' },
  { category: 'Data', name: 'Statistic', description: 'Single metric' },
  { category: 'Data', name: 'KPIGrid', description: 'KPI metric grid' },
  { category: 'Data', name: 'Table', description: 'Tabular result' },
  { category: 'Data', name: 'DescriptionList', description: 'Key-value description list' },
  { category: 'Data', name: 'Progress', description: 'Progress indicator' },
  { category: 'Chart', name: 'LineChart', description: 'Line chart' },
  { category: 'Chart', name: 'BarChart', description: 'Bar chart' },
  { category: 'Chart', name: 'PieChart', description: 'Pie chart' },
  { category: 'Chart', name: 'AreaChart', description: 'Area chart' },
  { category: 'Chart', name: 'MiniTrend', description: 'Small trend chart' },
  { category: 'Workflow', name: 'Steps', description: 'Step list' },
  { category: 'Workflow', name: 'Timeline', description: 'Timeline' },
  { category: 'Workflow', name: 'TaskList', description: 'Task list' },
  { category: 'Workflow', name: 'ApprovalCard', description: 'Human approval card' },
  { category: 'Media', name: 'ImagePreview', description: 'Image preview' },
  { category: 'Media', name: 'FileCard', description: 'File card' },
  { category: 'Media', name: 'AttachmentList', description: 'Attachment list' },
  { category: 'Code', name: 'CodeBlock', description: 'Code block' },
  { category: 'Code', name: 'DiffView', description: 'Before/after diff view' },
  { category: 'Code', name: 'FileTree', description: 'File tree' },
  { category: 'Knowledge', name: 'SourceList', description: 'Cited sources list' },
  { category: 'Knowledge', name: 'KnowledgeCard', description: 'Knowledge answer card' },
  { category: 'Knowledge', name: 'CitationCard', description: 'Citation card' },
  { category: 'Form', name: 'Form', description: 'Interactive form' },
  { category: 'Form', name: 'Input', description: 'Text input' },
  { category: 'Form', name: 'Select', description: 'Select input' },
  { category: 'Form', name: 'DatePicker', description: 'Date input' },
  { category: 'Form', name: 'Checkbox', description: 'Checkbox group' },
  { category: 'Form', name: 'Radio', description: 'Radio group' },
  { category: 'Form', name: 'TextArea', description: 'Textarea input' },
  { category: 'Form', name: 'SubmitButton', description: 'Form submit button' },
  { category: 'Actions', name: 'Button', description: 'Single command button' },
  { category: 'Actions', name: 'ButtonGroup', description: 'Command button group' },
  { category: 'Actions', name: 'DropdownAction', description: 'Dropdown command menu' },
  { category: 'Tool', name: 'ToolCallCard', description: 'Tool call state' },
  { category: 'Tool', name: 'ToolResultCard', description: 'Tool result' },
];

export const allowedComponents = new Set(assistantCatalog.map((item) => item.name));
