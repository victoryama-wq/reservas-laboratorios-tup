import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { AdminLabEditDialogComponent } from './admin-lab-edit-dialog.component';
import { AdminLabsService, AdminUpdateLabInput } from '../../services/admin-labs.service';
import { AdminLabGalleryService } from '../../services/admin-lab-gallery.service';

describe('Restricción dominical por laboratorio', () => {
  for (const initial of [undefined, true]) {
    it(`detecta y guarda el cambio desde ${initial === true ? 'activo' : 'sin configurar'}`, async () => {
      let saved: AdminUpdateLabInput | undefined;
      await TestBed.configureTestingModule({imports: [AdminLabEditDialogComponent], providers: [
        provideRouter([]),
        {provide: AdminLabsService, useValue: {}},
        {provide: AdminLabGalleryService, useValue: {}},
        {provide: MatDialogRef, useValue: {close: (value: AdminUpdateLabInput) => { saved = value; }}},
        {provide: MAT_DIALOG_DATA, useValue: {mode: 'edit', responsibleCandidates: [], lab: {
          id: 'lab-test', name: 'Prueba', slug: 'prueba', description: 'Prueba',
          calendarId: 'test-calendar', active: true, visibleInCatalog: true,
          minNoticeHours: 24, weeklySchedule: {},
          blockSundayRequestsForMondayMorning: initial,
        }}},
      ]}).compileComponents();
      const fixture = TestBed.createComponent(AdminLabEditDialogComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance;
      const control = component['form'].get('blockSundayRequestsForMondayMorning');
      expect(control?.value).toBe(initial === true);
      expect(component['hasChanges']()).toBe(false);
      control?.setValue(initial !== true);
      expect(component['hasChanges']()).toBe(true);
      component['save']();
      expect(saved?.blockSundayRequestsForMondayMorning).toBe(initial !== true);
      expect(saved?.labId).toBe('lab-test');
    });
  }
});
