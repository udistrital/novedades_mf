import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { ContractFilters, IContractRepository } from '../domain/repositories/contract.repository';
import { Contract } from '../domain/models/contract.entity';
import { ContractResponseDto } from './dtos/contract-response.dto';
import { NoveltyType, NoveltyStatus } from '../domain/models/novelty-type.enum';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';

@Injectable({
  providedIn: 'root'
})
export class MockContractService implements IContractRepository {

  private readonly mockData: ContractResponseDto[] = [
    {
      id: '1',
      number: '2027123',
      contractType: 'Contrato de Prestación de Servicios Profesionales o Apoyo a la Gestión',
      contractorName: 'DIEGO ANDRES BERNAL SILVA',
      contractorId: '807.324.23',
      contractingEntity: 'Universidad Distrital Francisco José de Caldas',
      totalValue: 1450000000,
      object: 'Mantenimiento preventivo y correctivo de la infraestructura física de la sede Macarena A y B, incluyendo suministro de materiales.',
      initialTerm: 'NUEVE ( 9 ) MESES',
      startDate: '01/01/2024',
      supervisor: 'Oficina Asesora Jurídica',
      spendingManager: 'PABLO ANDRES PÉREZ ALARCÓN',
      novelties: [
        {
          id: 'n1',
          type: NoveltyType.ADDITION_EXTENSION,
          expeditionDate: '02/04/2024',
          status: NoveltyStatus.IN_EXECUTION,
          canAnnul: true
        },
        {
          id: 'n2',
          type: NoveltyType.ASSIGNMENT,
          expeditionDate: '15/03/2024',
          status: NoveltyStatus.FINISHED,
          canAnnul: false
        }
      ]
    },
    {
      id: '2',
      number: '111327',
      contractType: 'Contrato de Prestación de Servicios Profesionales o Apoyo a la Gestión',
      contractorName: 'Servicios Tecnológicos UD',
      contractorId: '800.987.654-2',
      contractingEntity: 'Universidad Distrital Francisco José de Caldas',
      totalValue: 45000000,
      object: 'Renovación de licencias de software institucional.',
      initialTerm: 'SEIS ( 6 ) MESES',
      startDate: '01/02/2024',
      supervisor: 'Oficina Asesora Jurídica',
      spendingManager: 'PABLO ANDRES PÉREZ ALARCÓN',
      novelties: [
        {
          id: 'n3',
          type: NoveltyType.EXTENSION,
          expeditionDate: '10/11/2023',
          status: NoveltyStatus.FINISHED,
          canAnnul: true
        }
      ]
    },
    {
      id: '3',
      number: '2024558',
      contractType: 'Contrato de Prestación de Servicios Profesionales o Apoyo a la Gestión',
      contractorName: 'LAURA CAMILA RODRÍGUEZ MORENO',
      contractorId: '1.012.345.678',
      contractingEntity: 'Universidad Distrital Francisco José de Caldas',
      totalValue: 78000000,
      object: 'Apoyo a la gestión documental y archivística de la Secretaría General.',
      initialTerm: 'OCHO ( 8 ) MESES',
      startDate: '01/03/2024',
      supervisor: 'Oficina Asesora Jurídica',
      spendingManager: 'PABLO ANDRES PÉREZ ALARCÓN',
      novelties: [
        {
          id: 'n4',
          type: NoveltyType.SUSPENSION,
          expeditionDate: '20/05/2024',
          status: NoveltyStatus.IN_EXECUTION,
          canAnnul: true
        }
      ]
    }
  ];

  getContracts(filters?: ContractFilters): Observable<Contract[]> {
    let filteredData = [...this.mockData];

    if (filters) {
      if (filters.number) {
        filteredData = filteredData.filter(c => c.number.includes(filters.number!));
      }
      if (filters.contractor) {
        filteredData = filteredData.filter(c => c.contractorName.toLowerCase().includes(filters.contractor!.toLowerCase()) || c.contractorId.includes(filters.contractor!));
      }
    }

    // Simulate network delay
    return of(filteredData as Contract[]).pipe(delay(500));
  }

  getContractById(id: string): Observable<Contract | undefined> {
    const contract = this.mockData.find(c => c.id === id);
    return of(contract as Contract | undefined).pipe(delay(200));
  }

  createNovelty(contractId: string, draft: NoveltyDraft): Observable<void> {
    // Mock: en backend real haría el POST. Aquí solo lo registramos.
    return of(undefined).pipe(
      delay(400),
      tap(() => console.log('[Mock] Novedad creada para contrato', contractId, draft))
    );
  }

  annulNovelty(contractId: string, noveltyId: string): Observable<void> {
    return of(undefined).pipe(
      delay(400),
      tap(() => console.log('[Mock] Novedad anulada', contractId, noveltyId))
    );
  }
}
