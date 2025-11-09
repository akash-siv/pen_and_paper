import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  User,
  Building,
  Clock,
  Star,
  Users,
  ChevronLeft,
  ChevronRight,
  Check,
  MessageSquare
} from "lucide-react";

// Dummy lead data
const initialLeads = [
  {
    id: 1,
    name: "John Smith",
    email: "john.smith@example.com",
    phone: "+1 (555) 123-4567",
    company: "TechCorp Inc",
    position: "CTO",
    status: "New",
    source: "Meta Ads",
    value: 50000,
    createdDate: "2024-01-15",
    lastContact: "2024-01-20",
    location: "New York, NY",
    priority: 5,
    notes: "New lead from recent campaign"
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah.j@innovate.com",
    phone: "+1 (555) 234-5678",
    company: "Innovate Solutions",
    position: "Marketing Director",
    status: "Prospect",
    source: "Channel Partner",
    value: 35000,
    createdDate: "2024-01-18",
    lastContact: "2024-01-22",
    location: "San Francisco, CA",
    priority: 4,
    notes: "Qualified prospect, needs follow-up"
  },
  {
    id: 3,
    name: "Michael Chen",
    email: "m.chen@startup.io",
    phone: "+1 (555) 345-6789",
    company: "StartupIO",
    position: "Founder",
    status: "Unqualified",
    source: "Direct Source",
    value: 25000,
    createdDate: "2024-01-20",
    lastContact: "2024-01-21",
    location: "Austin, TX",
    priority: 2,
    notes: "Doesn't meet qualification criteria"
  },
  {
    id: 4,
    name: "Emily Rodriguez",
    email: "emily.r@globaltech.com",
    phone: "+1 (555) 456-7890",
    company: "Global Tech Solutions",
    position: "VP Operations",
    status: "Lost",
    source: "Meta Ads",
    value: 75000,
    createdDate: "2024-01-12",
    lastContact: "2024-01-23",
    location: "Chicago, IL",
    priority: 1,
    notes: "Lost to competitor, price sensitivity"
  },
  {
    id: 5,
    name: "David Wilson",
    email: "d.wilson@enterprise.org",
    phone: "+1 (555) 567-8901",
    company: "Enterprise Corp",
    position: "IT Manager",
    status: "Site Visit Scheduled",
    source: "Channel Partner",
    value: 45000,
    createdDate: "2024-01-10",
    lastContact: "2024-01-19",
    location: "Boston, MA",
    priority: 4,
    notes: "Site visit scheduled for next week"
  },
  {
    id: 6,
    name: "Lisa Thompson",
    email: "lisa.t@fastgrow.com",
    phone: "+1 (555) 678-9012",
    company: "FastGrow Inc",
    position: "CEO",
    status: "Site Visit Done",
    source: "Direct Source",
    value: 100000,
    createdDate: "2024-01-08",
    lastContact: "2024-01-24",
    location: "Seattle, WA",
    priority: 5,
    notes: "Site visit completed, decision pending"
  },
  {
    id: 7,
    name: "Robert Kumar",
    email: "r.kumar@techvision.in",
    phone: "+91 98765 43210",
    company: "TechVision India",
    position: "Director",
    status: "Prospect",
    source: "Channel Partner",
    value: 30000,
    createdDate: "2024-01-16",
    lastContact: "2024-01-20",
    location: "Mumbai, India",
    priority: 3,
    notes: "International prospect, good potential"
  },
  {
    id: 8,
    name: "Amanda Foster",
    email: "amanda.f@digitalnow.com",
    phone: "+1 (555) 789-0123",
    company: "Digital Now",
    position: "Product Manager",
    status: "Cold",
    source: "Meta Ads",
    value: 20000,
    createdDate: "2024-01-22",
    lastContact: "2024-01-22",
    location: "Denver, CO",
    priority: 2,
    notes: "No recent engagement, cold lead"
  },
  {
    id: 9,
    name: "Carlos Martinez",
    email: "c.martinez@techflow.com",
    phone: "+1 (555) 890-1234",
    company: "TechFlow Solutions",
    position: "Operations Manager",
    status: "New",
    source: "Direct Source",
    value: 55000,
    createdDate: "2024-01-25",
    lastContact: "2024-01-25",
    location: "Miami, FL",
    priority: 4,
    notes: "Interested in automation solutions"
  },
  {
    id: 10,
    name: "Jennifer Wu",
    email: "j.wu@innovatetech.com",
    phone: "+1 (555) 901-2345",
    company: "InnovateTech",
    position: "Head of IT",
    status: "Prospect",
    source: "Meta Ads",
    value: 65000,
    createdDate: "2024-01-14",
    lastContact: "2024-01-26",
    location: "Portland, OR",
    priority: 5,
    notes: "Strong interest, budget approved"
  },
  {
    id: 11,
    name: "Thomas Anderson",
    email: "t.anderson@nexus.com",
    phone: "+1 (555) 012-3456",
    company: "Nexus Corporation",
    position: "Technology Director",
    status: "Site Visit Scheduled",
    source: "Channel Partner",
    value: 85000,
    createdDate: "2024-01-11",
    lastContact: "2024-01-24",
    location: "Phoenix, AZ",
    priority: 5,
    notes: "Executive team meeting scheduled"
  },
  {
    id: 12,
    name: "Maria Santos",
    email: "m.santos@globalventures.com",
    phone: "+1 (555) 123-4567",
    company: "Global Ventures",
    position: "CEO",
    status: "Site Visit Done",
    source: "Direct Source",
    value: 120000,
    createdDate: "2024-01-05",
    lastContact: "2024-01-27",
    location: "Los Angeles, CA",
    priority: 5,
    notes: "Very positive feedback post-visit"
  },
  {
    id: 13,
    name: "Alex Thompson",
    email: "a.thompson@smartsystems.com",
    phone: "+1 (555) 234-5678",
    company: "Smart Systems Inc",
    position: "VP Technology",
    status: "Cold",
    source: "Meta Ads",
    value: 40000,
    createdDate: "2024-01-28",
    lastContact: "2024-01-28",
    location: "Atlanta, GA",
    priority: 2,
    notes: "Initial contact, needs warming up"
  },
  {
    id: 14,
    name: "Rachel Green",
    email: "r.green@futuretech.com",
    phone: "+1 (555) 345-6789",
    company: "FutureTech Solutions",
    position: "Product Manager",
    status: "Unqualified",
    source: "Channel Partner",
    value: 15000,
    createdDate: "2024-01-30",
    lastContact: "2024-01-30",
    location: "Nashville, TN",
    priority: 1,
    notes: "Budget too small for our solutions"
  },
  {
    id: 15,
    name: "James Brown",
    email: "j.brown@apex.com",
    phone: "+1 (555) 456-7890",
    company: "Apex Technologies",
    position: "CTO",
    status: "Prospect",
    source: "Direct Source",
    value: 90000,
    createdDate: "2024-01-13",
    lastContact: "2024-01-29",
    location: "Dallas, TX",
    priority: 4,
    notes: "Technical evaluation in progress"
  },
  {
    id: 16,
    name: "Sophie Clark",
    email: "s.clark@dynamicorp.com",
    phone: "+1 (555) 567-8901",
    company: "DynaCorp",
    position: "IT Director",
    status: "Lost",
    source: "Meta Ads",
    value: 60000,
    createdDate: "2024-01-17",
    lastContact: "2024-01-31",
    location: "San Diego, CA",
    priority: 1,
    notes: "Went with existing vendor"
  },
  {
    id: 17,
    name: "Kevin Lee",
    email: "k.lee@pinnacle.com",
    phone: "+1 (555) 678-9012",
    company: "Pinnacle Systems",
    position: "VP Operations",
    status: "New",
    source: "Channel Partner",
    value: 70000,
    createdDate: "2024-02-01",
    lastContact: "2024-02-01",
    location: "Minneapolis, MN",
    priority: 3,
    notes: "Referral from existing client"
  },
  {
    id: 18,
    name: "Diana Prince",
    email: "d.prince@wondertech.com",
    phone: "+1 (555) 789-0123",
    company: "WonderTech Inc",
    position: "CEO",
    status: "Site Visit Scheduled",
    source: "Direct Source",
    value: 110000,
    createdDate: "2024-01-09",
    lastContact: "2024-02-02",
    location: "Washington, DC",
    priority: 5,
    notes: "High-value prospect, C-level meeting"
  },
  {
    id: 19,
    name: "Ryan Taylor",
    email: "r.taylor@velocity.com",
    phone: "+1 (555) 890-1234",
    company: "Velocity Corp",
    position: "Technology Manager",
    status: "Cold",
    source: "Meta Ads",
    value: 35000,
    createdDate: "2024-02-03",
    lastContact: "2024-02-03",
    location: "Tampa, FL",
    priority: 2,
    notes: "Limited engagement so far"
  },
  {
    id: 20,
    name: "Michelle Davis",
    email: "m.davis@quantum.com",
    phone: "+1 (555) 901-2345",
    company: "Quantum Solutions",
    position: "Head of Digital",
    status: "Prospect",
    source: "Channel Partner",
    value: 80000,
    createdDate: "2024-01-21",
    lastContact: "2024-02-04",
    location: "Salt Lake City, UT",
    priority: 4,
    notes: "Strong technical requirements match"
  },
  {
    id: 21,
    name: "Nathan Phillips",
    email: "n.phillips@hypertech.com",
    phone: "+1 (555) 012-3456",
    company: "HyperTech Industries",
    position: "VP Engineering",
    status: "Site Visit Done",
    source: "Direct Source",
    value: 95000,
    createdDate: "2024-01-06",
    lastContact: "2024-02-05",
    location: "Charlotte, NC",
    priority: 5,
    notes: "Proposal under review by board"
  },
  {
    id: 22,
    name: "Ashley Moore",
    email: "a.moore@nexgen.com",
    phone: "+1 (555) 123-4567",
    company: "NexGen Technologies",
    position: "Product Director",
    status: "Unqualified",
    source: "Meta Ads",
    value: 22000,
    createdDate: "2024-02-06",
    lastContact: "2024-02-06",
    location: "Orlando, FL",
    priority: 1,
    notes: "Timeline doesn't align with our capacity"
  },
  {
    id: 23,
    name: "Christopher White",
    email: "c.white@summit.com",
    phone: "+1 (555) 234-5678",
    company: "Summit Corp",
    position: "CTO",
    status: "New",
    source: "Direct Source",
    value: 105000,
    createdDate: "2024-02-07",
    lastContact: "2024-02-07",
    location: "Kansas City, MO",
    priority: 5,
    notes: "Enterprise-level opportunity"
  },
  {
    id: 24,
    name: "Jessica Garcia",
    email: "j.garcia@stellar.com",
    phone: "+1 (555) 345-6789",
    company: "Stellar Systems",
    position: "Operations Director",
    status: "Lost",
    source: "Channel Partner",
    value: 50000,
    createdDate: "2024-01-23",
    lastContact: "2024-02-08",
    location: "Cincinnati, OH",
    priority: 1,
    notes: "Budget reallocated to other projects"
  },
  {
    id: 25,
    name: "Mark Johnson",
    email: "m.johnson@elite.com",
    phone: "+1 (555) 456-7890",
    company: "Elite Technologies",
    position: "VP Sales",
    status: "Prospect",
    source: "Meta Ads",
    value: 75000,
    createdDate: "2024-01-19",
    lastContact: "2024-02-09",
    location: "Indianapolis, IN",
    priority: 4,
    notes: "Multiple stakeholders involved"
  }
];

// Available lead statuses
const leadStatuses = [
  "New",
  "Prospect", 
  "Site Visit Scheduled",
  "Site Visit Done",
  "Unqualified",
  "Cold",
  "Lost"
];

// Lead stage transition rules based on the uploaded image
const getValidTransitions = (currentStatus) => {
  switch (currentStatus) {
    case "New":
      return ["Prospect", "Unqualified", "Cold"];
    case "Prospect":
      return ["Site Visit Scheduled", "Unqualified", "Cold"];
    case "Site Visit Scheduled":
      return ["Site Visit Done", "Lost", "Cold"]; // Hot, Warm, Cold mentioned in image
    case "Site Visit Done":
      return ["Site Visit Scheduled"]; // Can reschedule
    case "Unqualified":
      return ["Prospect"];
    case "Cold":
      return ["Prospect", "Site Visit Scheduled", "Unqualified"];
    case "Lost":
      return ["Prospect"];
    default:
      return [];
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case "New":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "Prospect":
      return "bg-green-100 text-green-800 border-green-200";
    case "Site Visit Scheduled":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "Site Visit Done":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "Unqualified":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Cold":
      return "bg-gray-100 text-gray-800 border-gray-200";
    case "Lost":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getSourceColor = (source) => {
  switch (source) {
    case "Meta Ads":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "Channel Partner":
      return "bg-green-100 text-green-800 border-green-200";
    case "Direct Source":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getSourceIcon = (source) => {
  switch (source) {
    case "Meta Ads":
      return <TrendingUp className="h-3 w-3" />;
    case "Channel Partner":
      return <Users className="h-3 w-3" />;
    case "Direct Source":
      return <Phone className="h-3 w-3" />;
    default:
      return <Building className="h-3 w-3" />;
  }
};

const getPriorityStars = (priority) => {
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={`h-3 w-3 ${
        i < priority ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
      }`}
    />
  ));
};

export default function LeadTable() {
  // Initialize leads from localStorage if available, otherwise use seed data
  const [leads, setLeads] = useState(() => {
    const saved = localStorage.getItem('leadsData');
    try {
      return saved ? JSON.parse(saved) : initialLeads;
    } catch (e) {
      return initialLeads;
    }
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [draggedItem, setDraggedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusUpdateMessage, setStatusUpdateMessage] = useState("");
  // View Lead popup state
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewLead, setViewLead] = useState(null);

  // Persist leads to localStorage on change
  useEffect(() => {
    localStorage.setItem('leadsData', JSON.stringify(leads));
  }, [leads]);

  // New Lead form state
  const emptyLead = {
    name: "",
    email: "",
    phone: "",
    company: "",
    position: "",
    status: "New",
    source: "Meta Ads",
    value: 0,
    location: "",
    priority: 3,
    notes: "",
  };
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newLead, setNewLead] = useState(emptyLead);
  const updateNewLead = (field, value) => setNewLead(prev => ({ ...prev, [field]: value }));

  // Search functionality
  const filteredLeads = useMemo(() => {
    return leads.filter(lead =>
      Object.values(lead).some(value =>
        value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [leads, searchTerm]);

  // Sort functionality
  const sortedLeads = useMemo(() => {
    if (!sortConfig.key) return filteredLeads;

    return [...filteredLeads].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [filteredLeads, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLeads = sortedLeads.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Create new lead
  const handleCreateLead = () => {
    // simple validation
    if (!newLead.name.trim()) {
      setStatusUpdateMessage('❌ Name is required.');
      setTimeout(() => setStatusUpdateMessage(''), 3000);
      return;
    }
    if (!newLead.email.trim() || !newLead.email.includes('@')) {
      setStatusUpdateMessage('❌ Valid email is required.');
      setTimeout(() => setStatusUpdateMessage(''), 3000);
      return;
    }

    const nextId = leads.reduce((max, l) => Math.max(max, l.id), 0) + 1;
    const today = new Date().toISOString().split('T')[0];
    const valueNum = Number(newLead.value) || 0;
    const priorityNum = parseInt(newLead.priority, 10) || 3;

    const created = {
      id: nextId,
      name: newLead.name.trim(),
      email: newLead.email.trim(),
      phone: newLead.phone.trim(),
      company: newLead.company.trim(),
      position: newLead.position.trim(),
      status: newLead.status,
      source: newLead.source,
      value: valueNum,
      createdDate: today,
      lastContact: today,
      location: newLead.location.trim(),
      priority: priorityNum,
      notes: newLead.notes.trim(),
    };

    setLeads(prev => [...prev, created]);
    setNewLead(emptyLead);
    setIsAddOpen(false);
    setStatusUpdateMessage(`✅ Lead "${created.name}" created`);
    setTimeout(() => setStatusUpdateMessage(''), 2500);
  };

  // Update lead status
  const updateLeadStatus = (leadId, newStatus) => {
    const leadToUpdate = leads.find(lead => lead.id === leadId);
    if (leadToUpdate && leadToUpdate.status !== newStatus) {
      const validTransitions = getValidTransitions(leadToUpdate.status);
      
      // Check if the transition is valid
      if (!validTransitions.includes(newStatus)) {
        setStatusUpdateMessage(`❌ Cannot change from "${leadToUpdate.status}" to "${newStatus}". Invalid transition.`);
        setTimeout(() => setStatusUpdateMessage(""), 4000);
        return;
      }
      
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === leadId 
            ? { ...lead, status: newStatus, lastContact: new Date().toISOString().split('T')[0] }
            : lead
        )
      );
      
      // Show success message
      setStatusUpdateMessage(`✅ ${leadToUpdate.name}'s status updated from "${leadToUpdate.status}" to "${newStatus}"`);
      setTimeout(() => setStatusUpdateMessage(""), 3000);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === "asc" ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  // Drag and Drop functionality
  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedItem === null) return;

    const newLeads = [...sortedLeads];
    const draggedLead = newLeads[draggedItem];
    newLeads.splice(draggedItem, 1);
    newLeads.splice(dropIndex, 0, draggedLead);
    
    setLeads(newLeads);
    setDraggedItem(null);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Build a dummy activity list for a lead
  const buildActivities = (lead) => {
    if (!lead) return [];
    const nameFirst = lead.name?.split(' ')[0] || 'Lead';
    const created = formatDate(lead.createdDate);
    const last = formatDate(lead.lastContact || lead.createdDate);
    return [
      { type: 'call',   title: 'Call completed',    at: last,   note: `Spoke with ${nameFirst} about needs and timeline.` },
      { type: 'sms',    title: 'SMS follow-up sent',at: last,   note: 'Shared brochure link and pricing page.' },
      { type: 'email',  title: 'Email sent',        at: created,note: 'Intro email with company profile and case studies.' },
      { type: 'note',   title: 'Lead created',      at: created,note: `Source: ${lead.source}. Priority: ${lead.priority}.` },
    ];
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4 text-blue-600" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      case 'email':
        return <Mail className="h-4 w-4 text-purple-600" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-600" />;
    }
  };

  const openLeadDialog = (lead) => {
    setViewLead(lead);
    setIsViewOpen(true);
  };

  // Quick actions inside the view dialog
  const handleCall = (phone) => {
    if (!phone) return;
    const num = String(phone).replace(/\s+/g, "");
    window.location.href = `tel:${num}`;
  };

  const handleEmailCompose = (email) => {
    if (!email) return;
    window.location.href = `mailto:${email}`;
  };

  const copyToClipboard = async (text, label = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      setStatusUpdateMessage(`✅ ${label}`);
      setTimeout(() => setStatusUpdateMessage(""), 2000);
    } catch (e) {
      setStatusUpdateMessage("❌ Failed to copy");
      setTimeout(() => setStatusUpdateMessage(""), 2000);
    }
  };

  const handleDeleteLead = (leadId) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setIsViewOpen(false);
    setViewLead(null);
    setStatusUpdateMessage("✅ Lead deleted");
    setTimeout(() => setStatusUpdateMessage(""), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Status Update Notification */}
      {statusUpdateMessage && (
        <div className={`rounded-lg p-3 ${
          statusUpdateMessage.startsWith('❌') 
            ? 'bg-red-50 border border-red-200' 
            : 'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusUpdateMessage.startsWith('❌') ? (
              <span className="text-red-600">❌</span>
            ) : (
              <Check className="h-4 w-4 text-green-600" />
            )}
            <span className={`text-sm ${
              statusUpdateMessage.startsWith('❌') 
                ? 'text-red-800' 
                : 'text-green-800'
            }`}>
              {statusUpdateMessage.replace(/^[❌✅]\s*/, '')}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lead Details</h2>
          <p className="text-muted-foreground">
            Manage your leads and track their progress through the sales pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <User className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Lead</DialogTitle>
                <DialogDescription>Fill in the details to create a new lead.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" className="col-span-3" value={newLead.name} onChange={(e) => updateNewLead('name', e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" type="email" className="col-span-3" value={newLead.email} onChange={(e) => updateNewLead('email', e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="phone" className="text-right">Phone</Label>
                  <Input id="phone" className="col-span-3" value={newLead.phone} onChange={(e) => updateNewLead('phone', e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="company" className="text-right">Company</Label>
                  <Input id="company" className="col-span-3" value={newLead.company} onChange={(e) => updateNewLead('company', e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="position" className="text-right">Position</Label>
                  <Input id="position" className="col-span-3" value={newLead.position} onChange={(e) => updateNewLead('position', e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label className="text-right">Status</Label>
                  <div className="col-span-3">
                    <Select value={newLead.status} onValueChange={(v) => updateNewLead('status', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {leadStatuses.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label className="text-right">Source</Label>
                  <div className="col-span-3">
                    <Select value={newLead.source} onValueChange={(v) => updateNewLead('source', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Meta Ads">Meta Ads</SelectItem>
                        <SelectItem value="Channel Partner">Channel Partner</SelectItem>
                        <SelectItem value="Direct Source">Direct Source</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="value" className="text-right">Value</Label>
                  <Input id="value" type="number" min="0" className="col-span-3" value={newLead.value} onChange={(e) => updateNewLead('value', e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="location" className="text-right">Location</Label>
                  <Input id="location" className="col-span-3" value={newLead.location} onChange={(e) => updateNewLead('location', e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label className="text-right">Priority</Label>
                  <div className="col-span-3">
                    <Select value={String(newLead.priority)} onValueChange={(v) => updateNewLead('priority', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map(p => (
                          <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-2">
                  <Label htmlFor="notes" className="text-right">Notes</Label>
                  <textarea id="notes" className="col-span-3 min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newLead.notes} onChange={(e) => updateNewLead('notes', e.target.value)} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleCreateLead} className="bg-blue-600 hover:bg-blue-700">Create Lead</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm">
            Export
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads by name, company, email, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Filter
          </Button>
          <Button variant="outline" size="sm">
            Sort
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
              <p className="text-2xl font-bold">{leads.length}</p>
            </div>
            <User className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Prospects</p>
              <p className="text-2xl font-bold">{leads.filter(l => l.status === 'Prospect').length}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">
                {formatCurrency(leads.reduce((sum, lead) => sum + lead.value, 0))}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Deal Size</p>
              <p className="text-2xl font-bold">
                {formatCurrency(leads.reduce((sum, lead) => sum + lead.value, 0) / leads.length)}
              </p>
            </div>
            <Building className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1} to {Math.min(endIndex, sortedLeads.length)} of {sortedLeads.length} leads
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <Select value={itemsPerPage.toString()} onValueChange={(value) => handleItemsPerPageChange(parseInt(value))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">entries</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("name")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Lead Info
                  {getSortIcon("name")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("company")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Company
                  {getSortIcon("company")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("status")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Status
                  {getSortIcon("status")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("source")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Lead Source
                  {getSortIcon("source")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("value")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Value
                  {getSortIcon("value")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("priority")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Priority
                  {getSortIcon("priority")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("createdDate")}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Created
                  {getSortIcon("createdDate")}
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentLeads.map((lead, index) => (
              <TableRow
                key={lead.id}
                className="cursor-move hover:bg-muted/50 transition-colors"
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <TableCell className="font-medium text-muted-foreground">
                  {lead.id}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{lead.name}</div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {lead.email}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {lead.phone}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{lead.company}</div>
                    <div className="text-sm text-muted-foreground">{lead.position}</div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {lead.location}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSourceColor(lead.source)}`}>
                      <span className="mr-1">{getSourceIcon(lead.source)}</span>
                      {lead.source}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{formatCurrency(lead.value)}</div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(lead.lastContact)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {getPriorityStars(lead.priority)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{formatDate(lead.createdDate)}</div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openLeadDialog(lead)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    {/* Edit Status Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                          Change Status from "{lead.status}"
                        </div>
                        <div className="px-2 py-1 text-xs text-muted-foreground border-b mb-1">
                          Valid transitions only
                        </div>
                        {leadStatuses.map((status) => {
                          const validTransitions = getValidTransitions(lead.status);
                          const isCurrentStatus = lead.status === status;
                          const isValidTransition = validTransitions.includes(status);
                          const isDisabled = !isCurrentStatus && !isValidTransition;
                          
                          return (
                            <DropdownMenuItem
                              key={status}
                              onClick={() => !isDisabled && updateLeadStatus(lead.id, status)}
                              className={`flex items-center justify-between ${
                                isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                              }`}
                              disabled={isDisabled}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${getStatusColor(status).split(' ')[0]}`}></span>
                                <span className={isDisabled ? 'line-through' : ''}>{status}</span>
                                {isDisabled && <span className="text-xs text-red-500">✗</span>}
                              </div>
                              {isCurrentStatus && (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                              {isValidTransition && !isCurrentStatus && (
                                <span className="text-xs text-green-500">✓</span>
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

  {/* Lead Detail shown in a popup Dialog via Eye button */}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages} ({sortedLeads.length} total leads)
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToPrevPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => goToPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* View Lead Dialog */}
      <Dialog open={isViewOpen} onOpenChange={(o) => { setIsViewOpen(o); if (!o) setViewLead(null); }}>
        <DialogContent className="max-w-5xl sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl">
          {viewLead && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-base font-semibold">
                      {viewLead.name?.split(' ').map(n=>n[0]).slice(0,2).join('')}
                    </div>
                    <div>
                      <div className="text-lg font-semibold leading-tight">{viewLead.name}</div>
                      <div className="text-xs text-muted-foreground">{viewLead.position} • {viewLead.company}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(viewLead.status)}`}>
                      {viewLead.status}
                    </span>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleCall(viewLead.phone)}>
                      <Phone className="h-4 w-4 mr-1" /> Call
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleEmailCompose(viewLead.email)}>
                      <Mail className="h-4 w-4 mr-1" /> Email
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => copyToClipboard(`${viewLead.name} | ${viewLead.email} | ${viewLead.phone}`, 'Lead info copied')}>
                          Copy lead info
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyToClipboard(viewLead.email, 'Email copied')}>
                          Copy email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyToClipboard(viewLead.phone, 'Phone copied')}>
                          Copy phone
                        </DropdownMenuItem>
                        <div className="border-t my-1" />
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">Change status</div>
                        {leadStatuses.map((status) => (
                          <DropdownMenuItem key={status} onClick={() => updateLeadStatus(viewLead.id, status)}>
                            {status}
                          </DropdownMenuItem>
                        ))}
                        <div className="border-t my-1" />
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteLead(viewLead.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete lead
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </DialogTitle>
                <DialogDescription className="hidden" />
              </DialogHeader>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{viewLead.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{viewLead.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{viewLead.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>{formatCurrency(viewLead.value)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSourceColor(viewLead.source)}`}>
                      <span className="mr-1">{getSourceIcon(viewLead.source)}</span>
                      {viewLead.source}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-muted/40">
                      Priority: {viewLead.priority}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-muted/40">
                      Created: {formatDate(viewLead.createdDate)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">Notes</div>
                  <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap min-h-12">{viewLead.notes || '—'}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Activity</div>
                <div className="relative pl-6">
                  <div className="absolute left-2 top-0 bottom-0 border-l"></div>
                  <div className="space-y-3">
                    {buildActivities(viewLead).map((act, idx) => (
                      <div key={idx} className="relative">
                        <span className="absolute -left-[7px] top-1.5 h-3.5 w-3.5 rounded-full bg-blue-600 ring-2 ring-offset-background"></span>
                        <div className="ml-2">
                          <div className="flex items-center gap-2">
                            {getActivityIcon(act.type)}
                            <div className="text-sm font-medium">{act.title}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">{act.at}</div>
                          <div className="text-sm text-muted-foreground mt-0.5">{act.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
