import React, { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Mail, Phone, MapPin, DollarSign, ArrowLeft, Users, TrendingUp, Building, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

// Reuse helpers lightly (duplicated minimal versions to avoid import cycles)
const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const getStatusColor = (status) => {
  switch (status) {
    case 'New': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'Prospect': return 'bg-green-100 text-green-800 border-green-200'
    case 'Site Visit Scheduled': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'Site Visit Done': return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'Unqualified': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'Cold': return 'bg-gray-100 text-gray-800 border-gray-200'
    case 'Lost': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}
const getSourceColor = (source) => {
  switch (source) {
    case 'Meta Ads': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'Channel Partner': return 'bg-green-100 text-green-800 border-green-200'
    case 'Direct Source': return 'bg-purple-100 text-purple-800 border-purple-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}
const getSourceIcon = (source) => {
  switch (source) {
    case 'Meta Ads': return <TrendingUp className="h-3 w-3" />
    case 'Channel Partner': return <Users className="h-3 w-3" />
    case 'Direct Source': return <Phone className="h-3 w-3" />
    default: return <Building className="h-3 w-3" />
  }
}

const buildActivities = (lead) => {
  if (!lead) return []
  const nameFirst = lead.name?.split(' ')[0] || 'Lead'
  const created = formatDate(lead.createdDate)
  const last = formatDate(lead.lastContact || lead.createdDate)
  return [
    { type: 'call',   title: 'Call completed',    at: last,   note: `Spoke with ${nameFirst} about needs and timeline.` },
    { type: 'sms',    title: 'SMS follow-up sent',at: last,   note: 'Shared brochure link and pricing page.' },
    { type: 'email',  title: 'Email sent',        at: created,note: 'Intro email with company profile and case studies.' },
    { type: 'note',   title: 'Lead created',      at: created,note: `Source: ${lead.source}. Priority: ${lead.priority}.` },
  ]
}

export default function LeadDetail() {
  const { id } = useParams()
  const leads = useMemo(() => {
    const saved = localStorage.getItem('leadsData')
    try { return saved ? JSON.parse(saved) : [] } catch { return [] }
  }, [])
  const lead = leads.find(l => String(l.id) === String(id))

  if (!lead) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
        <div className="rounded-lg border bg-card p-8">
          <div className="text-base">Lead not found.</div>
          <div className="text-sm text-muted-foreground mt-1">It may have been removed or your data was reset.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">Leads</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{lead.name}</span>
        </div>
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>
          {lead.status}
        </div>
      </div>

      {/* Hero Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-lg font-semibold">
              {lead.name?.split(' ').map(n=>n[0]).slice(0,2).join('')}
            </div>
            <div>
              <div className="text-2xl font-semibold leading-tight">{lead.name}</div>
              <div className="text-sm text-muted-foreground">{lead.position} • {lead.company}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSourceColor(lead.source)}`}>
                  <span className="mr-1">{getSourceIcon(lead.source)}</span>
                  {lead.source}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-muted/50">Priority: {lead.priority}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-muted/50">Created: {formatDate(lead.createdDate)}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-muted/50">Last: {formatDate(lead.lastContact)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Deal Value</div>
            <div className="text-2xl font-bold">{formatCurrency(lead.value)}</div>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>{lead.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{lead.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{lead.location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Last contact: {formatDate(lead.lastContact)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Notes + Activity */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium">Notes</div>
            <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap min-h-12">
              {lead.notes || '—'}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium mb-3">Activity</div>
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 border-l"></div>
              <div className="space-y-4">
        {buildActivities(lead).map((act, idx) => (
                  <div key={idx} className="relative">
          <span className="absolute -left-[7px] top-1.5 h-3.5 w-3.5 rounded-full bg-blue-600 ring-2 ring-offset-background"></span>
                    <div className="ml-2">
                      <div className="text-sm font-medium">{act.title}</div>
                      <div className="text-xs text-muted-foreground">{act.at}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{act.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions + Pipeline */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium mb-3">Quick Actions</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline"><Phone className="h-4 w-4 mr-1" /> Call</Button>
              <Button size="sm" variant="outline"><Mail className="h-4 w-4 mr-1" /> Email</Button>
              <Button size="sm" variant="outline"><Users className="h-4 w-4 mr-1" /> SMS</Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium mb-2">Pipeline</div>
            <div className="text-sm text-muted-foreground">Current stage:</div>
            <div className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>{lead.status}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
