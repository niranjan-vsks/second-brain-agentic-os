"use client"

import type { JobApplication } from "@/lib/types"
import { JobDetail } from "@/components/career/job-detail"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function JobDetailDialog({ job, onClose }: { job: JobApplication; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {job.roleTitle} at {job.company}
          </DialogTitle>
        </DialogHeader>
        <JobDetail job={job} onBack={onClose} />
      </DialogContent>
    </Dialog>
  )
}
