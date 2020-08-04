import {Request, Response} from 'express';
import db from "../database/connection";
import convertHourToMinutes from "../utils/convertHourToMinutes";

interface ScheduleItem {
  week_day: number;
  from: string,
  to: string,
}

export default class ClassesController {
  async index(req: Request, res: Response){
    const filter = req.query;

    const subject = filter.subject as string;
    const week_day = filter.week_day as string;
    const time = filter.time as string;

    if(!filter.subject || !filter.week_day || !filter.time) {
      return res.status(400).json({ error: 'Informe o filtro para buscar as aulas'});
    }

    const timeInMunutes = convertHourToMinutes(time);

    const classes = await db('classes')
      .whereExists(function () {
        this.select('classes_schedule.*')
          .from('classes_schedule')
          .whereRaw('`classes_schedule`.`class_id` = `classes`.`id`')
          .whereRaw('`classes_schedule`.`week_day` = ??', [Number(week_day)])
          .whereRaw('`classes_schedule`.`from` <= ??', [timeInMunutes])
          .whereRaw('`classes_schedule`.`to` > ??', [timeInMunutes])
      })
      .where('classes.subject', '=', subject)
      .join('users', 'classes.user_id', '=', 'users.id')
      .select(['classes.*', 'users.*']);

      return res.json(classes);
  }

  async store (req: Request, res: Response) {
    const {
      name, 
      avatar,
      whatsapp,
      bio, 
      subject,
      cost,
      schedule
    } = req.body;
  
    const trx = await db.transaction();
  
    try {    
  
      const usersIds = await trx('users').insert({
        name,
        avatar,
        whatsapp,
        bio, 
      });//retorna a lista de ids dos usuários cadastrados, por isso pego a primeira posição
  
      const classesIds = await trx('classes').insert({
        subject,
        cost,
        user_id: usersIds[0],
      });
  
      const classeSchedule = schedule.map((scheduleItem: ScheduleItem) => {
        return {
          class_id: classesIds[0],
          week_day: scheduleItem.week_day,
          from: convertHourToMinutes(scheduleItem.from),
          to: convertHourToMinutes(scheduleItem.to),
        };
      });
  
      await trx('classes_schedule').insert(classeSchedule)
  
      await trx.commit();  
      
      return res.status(201).json({succsses: 'Aula criada com sucesso'});
    } catch (err) {
      await trx.rollback();
  
      return res.status(400).json({
        error: 'Erro ao criar a aula.'
      });
    }     
  }
}